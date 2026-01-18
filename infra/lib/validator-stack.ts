import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ValidatorStackProps extends cdk.StackProps {
  /** Approval handler Lambda from DQRecommenderStack */
  approvalHandlerArn?: string;
}

/**
 * ValidatorStack: Creates infrastructure for data validation workflow.
 *
 * Resources:
 * - Lambda function for processing validation results
 * - SQS queue for approval requests
 * - Step Functions state machine for validation orchestration
 * - IAM roles with Glue DQ and Lambda permissions
 */
export class ValidatorStack extends cdk.Stack {
  /** Lambda function for validation result processing */
  public readonly validatorProcessor: lambda.Function;
  /** SQS queue for approval workflow */
  public readonly approvalQueue: sqs.Queue;
  /** Step Functions state machine */
  public readonly stateMachine: sfn.StateMachine;
  /** State machine ARN */
  public readonly stateMachineArn: string;

  constructor(scope: Construct, id: string, props?: ValidatorStackProps) {
    super(scope, id, props);

    // Reference Supabase secrets
    const supabaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'SupabaseSecret',
      'profiler/supabase'
    );

    // CloudWatch log group for Lambda
    const logGroup = new logs.LogGroup(this, 'ValidatorProcessorLogGroup', {
      logGroupName: '/aws/lambda/dq-validator-processor',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function for processing validation results
    this.validatorProcessor = new lambda.Function(this, 'ValidatorProcessor', {
      functionName: 'dq-validator-processor',
      description: 'Processes Glue Data Quality validation results',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../lambdas/validator'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'dq-validator-processor',
        POWERTOOLS_LOG_LEVEL: 'INFO',
      },
      logGroup,
    });

    // Grant Lambda permission to read Supabase secrets
    supabaseSecret.grantRead(this.validatorProcessor);
    this.validatorProcessor.addEnvironment('SUPABASE_SECRET_NAME', 'profiler/supabase');

    // Grant Glue Data Quality permissions
    this.validatorProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'glue:GetDataQualityRulesetEvaluationRun',
          'glue:BatchGetDataQualityResult',
          'glue:GetDataQualityResult',
        ],
        resources: ['*'],
      })
    );

    // SQS queue for approval workflow
    // Max visibility timeout is 12 hours (43200 seconds)
    this.approvalQueue = new sqs.Queue(this, 'ApprovalQueue', {
      queueName: 'dq-rule-approval-queue',
      visibilityTimeout: cdk.Duration.hours(12),
      retentionPeriod: cdk.Duration.days(7),
    });

    // Dead letter queue for failed approvals
    const dlq = new sqs.Queue(this, 'ApprovalDLQ', {
      queueName: 'dq-rule-approval-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    // State machine log group
    const stateMachineLogGroup = new logs.LogGroup(this, 'ValidationWorkflowLogGroup', {
      logGroupName: '/aws/stepfunctions/validation-workflow',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Step Functions state machine definition
    // State: CheckRuleStatus - determines if rules need approval
    const checkRuleStatus = new sfn.Choice(this, 'CheckRuleStatus', {
      comment: 'Check if rules are approved or need approval',
    });

    // State: RequestApproval - send to SQS and wait for callback
    const requestApproval = new tasks.SqsSendMessage(this, 'RequestApproval', {
      queue: this.approvalQueue,
      messageBody: sfn.TaskInput.fromObject({
        taskToken: sfn.JsonPath.taskToken,
        rules: sfn.JsonPath.objectAt('$.rules'),
        datasetRef: sfn.JsonPath.stringAt('$.datasetRef'),
        reasoning: sfn.JsonPath.stringAt('$.reasoning'),
        validationRunId: sfn.JsonPath.stringAt('$.validationRunId'),
      }),
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      resultPath: '$.approvalResult',
      comment: 'Send approval request and wait for human review',
    });

    // Add timeout and catch for approval
    requestApproval.addRetry({
      errors: ['SQS.AmazonSQSException'],
      interval: cdk.Duration.seconds(10),
      maxAttempts: 3,
      backoffRate: 2,
    });

    // State: ApprovalTimedOut - handle timeout
    const approvalTimedOut = new sfn.Fail(this, 'ApprovalTimedOut', {
      error: 'ApprovalTimeout',
      cause: 'Rule approval request timed out after 24 hours',
    });

    // State: ExecuteValidation - run Glue DQ validation
    const executeValidation = new tasks.CallAwsService(this, 'ExecuteValidation', {
      service: 'glue',
      action: 'startDataQualityRulesetEvaluationRun',
      parameters: {
        DataSource: {
          GlueTable: {
            DatabaseName: sfn.JsonPath.stringAt('$.database'),
            TableName: sfn.JsonPath.stringAt('$.table'),
          },
        },
        RulesetNames: sfn.JsonPath.listAt('$.rulesetNames'),
        Role: sfn.JsonPath.stringAt('$.glueRole'),
      },
      iamResources: ['*'],
      iamAction: 'glue:StartDataQualityRulesetEvaluationRun',
      resultPath: '$.glueResult',
      comment: 'Start Glue Data Quality ruleset evaluation',
    });

    // Add retry for Glue concurrent runs exception
    executeValidation.addRetry({
      errors: ['Glue.ConcurrentRunsExceededException'],
      interval: cdk.Duration.seconds(60),
      maxAttempts: 3,
      backoffRate: 2,
    });

    // State: WaitForGlue - wait for Glue job completion
    const waitForGlue = new sfn.Wait(this, 'WaitForGlue', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(30)),
    });

    // State: CheckGlueStatus - poll Glue job status
    const checkGlueStatus = new tasks.CallAwsService(this, 'CheckGlueStatus', {
      service: 'glue',
      action: 'getDataQualityRulesetEvaluationRun',
      parameters: {
        RunId: sfn.JsonPath.stringAt('$.glueResult.RunId'),
      },
      iamResources: ['*'],
      iamAction: 'glue:GetDataQualityRulesetEvaluationRun',
      resultPath: '$.glueStatus',
    });

    // State: IsGlueComplete - check if Glue job finished
    const isGlueComplete = new sfn.Choice(this, 'IsGlueComplete', {
      comment: 'Check if Glue DQ run is complete',
    });

    // State: ProcessResults - invoke Lambda to process results
    const processResults = new tasks.LambdaInvoke(this, 'ProcessResults', {
      lambdaFunction: this.validatorProcessor,
      payload: sfn.TaskInput.fromObject({
        run_id: sfn.JsonPath.stringAt('$.glueResult.RunId'),
        dataset_id: sfn.JsonPath.stringAt('$.datasetId'),
        validation_run_id: sfn.JsonPath.stringAt('$.validationRunId'),
      }),
      resultPath: '$.processedResults',
      comment: 'Process Glue DQ results and store in database',
    });

    // State: CheckQualityScore - decide if alert needed
    const checkQualityScore = new sfn.Choice(this, 'CheckQualityScore', {
      comment: 'Check if quality score is below threshold',
    });

    // State: TriggerAlert - emit EventBridge event for alert
    const triggerAlert = new tasks.EventBridgePutEvents(this, 'TriggerAlert', {
      entries: [{
        source: 'data-quality.validator',
        detailType: 'QualityCheckFailed',
        detail: sfn.TaskInput.fromObject({
          dataset_id: sfn.JsonPath.stringAt('$.datasetId'),
          run_id: sfn.JsonPath.stringAt('$.validationRunId'),
          score: sfn.JsonPath.numberAt('$.processedResults.Payload.overall_score'),
          severity: 'warning',
          title: sfn.JsonPath.format('Quality check failed for {}', sfn.JsonPath.stringAt('$.datasetRef')),
          message: sfn.JsonPath.format(
            'Quality score {} is below threshold 0.8',
            sfn.JsonPath.stringAt('$.processedResults.Payload.overall_score')
          ),
          details: sfn.JsonPath.objectAt('$.processedResults.Payload'),
        }),
      }],
      resultPath: '$.alertResult',
      comment: 'Emit quality check failed event',
    });

    // State: ValidationComplete - success state
    const validationComplete = new sfn.Succeed(this, 'ValidationComplete', {
      comment: 'Validation workflow completed successfully',
    });

    // State: HandleValidationError - error handling
    const handleValidationError = new sfn.Fail(this, 'HandleValidationError', {
      error: 'ValidationFailed',
      cause: 'Glue Data Quality validation failed',
    });

    // Wire up the state machine
    // Check rule status branch
    checkRuleStatus
      .when(
        sfn.Condition.stringEquals('$.ruleStatus', 'pending'),
        requestApproval
      )
      .when(
        sfn.Condition.stringEquals('$.ruleStatus', 'approved'),
        executeValidation
      )
      .otherwise(executeValidation);

    // Approval flow with timeout
    requestApproval.next(executeValidation);

    // Add catch for timeout on request approval
    requestApproval.addCatch(approvalTimedOut, {
      errors: ['States.Timeout'],
    });

    // Glue execution -> poll loop
    executeValidation.next(waitForGlue);
    executeValidation.addCatch(handleValidationError, {
      errors: ['States.ALL'],
    });

    waitForGlue.next(checkGlueStatus);

    // Polling loop for Glue completion
    isGlueComplete
      .when(
        sfn.Condition.stringEquals('$.glueStatus.Status', 'SUCCEEDED'),
        processResults
      )
      .when(
        sfn.Condition.stringEquals('$.glueStatus.Status', 'FAILED'),
        handleValidationError
      )
      .otherwise(waitForGlue);

    checkGlueStatus.next(isGlueComplete);

    // Process results -> check score
    processResults.next(checkQualityScore);

    // Quality score check
    checkQualityScore
      .when(
        sfn.Condition.numberLessThan('$.processedResults.Payload.overall_score', 0.8),
        triggerAlert
      )
      .otherwise(validationComplete);

    // Alert -> complete
    triggerAlert.next(validationComplete);

    // Create state machine
    this.stateMachine = new sfn.StateMachine(this, 'ValidationWorkflow', {
      stateMachineName: 'validation-workflow',
      definitionBody: sfn.DefinitionBody.fromChainable(checkRuleStatus),
      timeout: cdk.Duration.hours(25), // Approval timeout + execution buffer
      tracingEnabled: true,
      logs: {
        destination: stateMachineLogGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    this.stateMachineArn = this.stateMachine.stateMachineArn;

    // Grant state machine permissions
    this.stateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'glue:StartDataQualityRulesetEvaluationRun',
          'glue:GetDataQualityRulesetEvaluationRun',
        ],
        resources: ['*'],
      })
    );

    // Grant EventBridge permissions
    this.stateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: ['*'],
      })
    );

    // Grant SQS permissions
    this.approvalQueue.grantSendMessages(this.stateMachine);

    // Grant Lambda invoke permissions
    this.validatorProcessor.grantInvoke(this.stateMachine);

    // Outputs
    new cdk.CfnOutput(this, 'ValidatorProcessorArn', {
      value: this.validatorProcessor.functionArn,
      exportName: 'DQValidatorProcessorArn',
      description: 'ARN of the validator processor Lambda function',
    });

    new cdk.CfnOutput(this, 'ApprovalQueueUrl', {
      value: this.approvalQueue.queueUrl,
      exportName: 'DQApprovalQueueUrl',
      description: 'URL of the approval SQS queue',
    });

    new cdk.CfnOutput(this, 'ValidationStateMachineArn', {
      value: this.stateMachineArn,
      exportName: 'ValidationStateMachineArn',
      description: 'ARN of the validation workflow state machine',
    });
  }
}
