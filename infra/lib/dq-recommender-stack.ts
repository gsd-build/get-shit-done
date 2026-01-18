import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * DQRecommenderStack: Creates infrastructure for the DQ Recommender service.
 *
 * Resources:
 * - Lambda function for approval webhook handler
 * - API Gateway HTTP endpoint for approvals
 * - IAM roles with Step Functions permissions
 */
export class DQRecommenderStack extends cdk.Stack {
  /** Lambda function for approval handling */
  public readonly approvalHandler: lambda.Function;
  /** API Gateway HTTP API */
  public readonly httpApi: apigateway.HttpApi;
  /** API endpoint URL */
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference Supabase secrets (must be created manually or via separate stack)
    const supabaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'SupabaseSecret',
      'profiler/supabase'
    );

    // CloudWatch log group for Lambda
    const logGroup = new logs.LogGroup(this, 'ApprovalHandlerLogGroup', {
      logGroupName: '/aws/lambda/dq-approval-handler',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function for approval handling
    this.approvalHandler = new lambda.Function(this, 'ApprovalHandler', {
      functionName: 'dq-approval-handler',
      description: 'Handles human approval/rejection of AI-generated DQ rules',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../lambdas/approval_handler'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'dq-approval-handler',
        POWERTOOLS_LOG_LEVEL: 'INFO',
        // Secrets are injected from Secrets Manager at runtime
      },
      logGroup,
    });

    // Grant Lambda permission to read Supabase secrets
    supabaseSecret.grantRead(this.approvalHandler);

    // Allow Lambda to access secrets via environment
    // The Lambda will read these at runtime from Secrets Manager
    this.approvalHandler.addEnvironment(
      'SUPABASE_SECRET_NAME',
      'profiler/supabase'
    );

    // Grant Step Functions permissions
    this.approvalHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'states:SendTaskSuccess',
          'states:SendTaskFailure',
        ],
        // Allow signaling any state machine in this account
        resources: [`arn:aws:states:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stateMachine:*`],
      })
    );

    // Create HTTP API Gateway
    this.httpApi = new apigateway.HttpApi(this, 'DQApprovalApi', {
      apiName: 'dq-approval-api',
      description: 'HTTP API for DQ rule approval workflow',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'], // Restrict in production
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Create Lambda integration
    const lambdaIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'ApprovalIntegration',
      this.approvalHandler
    );

    // Add POST /approvals route
    this.httpApi.addRoutes({
      path: '/approvals',
      methods: [apigateway.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    // Store API endpoint
    this.apiEndpoint = this.httpApi.apiEndpoint;

    // Outputs
    new cdk.CfnOutput(this, 'ApprovalHandlerArn', {
      value: this.approvalHandler.functionArn,
      exportName: 'DQApprovalHandlerArn',
      description: 'ARN of the approval handler Lambda function',
    });

    new cdk.CfnOutput(this, 'ApprovalApiEndpoint', {
      value: this.apiEndpoint,
      exportName: 'DQApprovalApiEndpoint',
      description: 'HTTP API endpoint for rule approvals',
    });

    new cdk.CfnOutput(this, 'ApprovalApiUrl', {
      value: `${this.apiEndpoint}/approvals`,
      exportName: 'DQApprovalApiUrl',
      description: 'Full URL for the approvals endpoint',
    });
  }
}
