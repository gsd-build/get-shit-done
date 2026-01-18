import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ProfilerStackProps extends cdk.StackProps {
  /** S3 bucket for storing profile results */
  profileResultsBucket: s3.IBucket;
}

/**
 * ProfilerStack: Creates the compute infrastructure for the Data Profiler.
 *
 * Resources:
 * - VPC with public subnets (Fargate tasks need internet access for Supabase/AWS APIs)
 * - ECS Fargate cluster with profiler container
 * - ECR repository for profiler Docker image
 * - Task definition with container and environment configuration
 * - Step Functions state machine for profiler orchestration with ECS RunTask
 * - IAM roles with appropriate permissions
 * - Security group for outbound HTTPS
 */
export class ProfilerStack extends cdk.Stack {
  /** ECS cluster for running profiler tasks */
  public readonly cluster: ecs.Cluster;
  /** Task execution role for ECS */
  public readonly taskExecutionRole: iam.Role;
  /** Task role for profiler permissions */
  public readonly taskRole: iam.Role;
  /** Security group for Fargate tasks */
  public readonly securityGroup: ec2.SecurityGroup;
  /** Step Functions state machine for orchestration */
  public readonly stateMachine: sfn.StateMachine;
  /** ECR repository for profiler image */
  public readonly ecrRepository: ecr.Repository;
  /** Task definition for profiler */
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: ProfilerStackProps) {
    super(scope, id, props);

    // VPC with 2 public subnets for Fargate tasks
    // Public subnets because tasks need to reach Supabase (external) and AWS APIs
    const vpc = new ec2.Vpc(this, 'ProfilerVpc', {
      vpcName: 'profiler-vpc',
      maxAzs: 2,
      natGateways: 0, // No NAT for cost savings - using public subnets
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // Security group allowing outbound HTTPS only
    this.securityGroup = new ec2.SecurityGroup(this, 'ProfilerSecurityGroup', {
      vpc,
      securityGroupName: 'profiler-sg',
      description: 'Security group for Data Profiler Fargate tasks',
      allowAllOutbound: false, // Explicit outbound rules
    });

    // Allow outbound HTTPS (443) for AWS APIs and Supabase
    this.securityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow outbound HTTPS'
    );

    // ECS Fargate cluster
    this.cluster = new ecs.Cluster(this, 'ProfilerCluster', {
      clusterName: 'profiler-cluster',
      vpc,
      containerInsights: true, // Enable CloudWatch Container Insights
    });

    // ECR repository for profiler Docker image
    this.ecrRepository = new ecr.Repository(this, 'ProfilerRepository', {
      repositoryName: 'data-profiler',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Clean up on stack delete
      emptyOnDelete: true,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10, // Keep last 10 images
          description: 'Keep last 10 images',
        },
      ],
    });

    // Task execution role - ECR pull, CloudWatch logs, Secrets Manager
    this.taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      roleName: 'profiler-task-execution-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant ECR pull permission
    this.ecrRepository.grantPull(this.taskExecutionRole);

    // Grant Secrets Manager read for task execution (for container secrets)
    this.taskExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [`arn:aws:secretsmanager:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:secret:profiler/*`],
    }));

    // Task role - S3, Secrets Manager, data sources access
    this.taskRole = new iam.Role(this, 'TaskRole', {
      roleName: 'profiler-task-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant task role access to profile results bucket
    props.profileResultsBucket.grantReadWrite(this.taskRole);

    // Grant Bedrock access for Strands agent
    this.taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.*`],
    }));

    // Grant Secrets Manager access for connection credentials
    this.taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [`arn:aws:secretsmanager:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:secret:profiler/*`],
    }));

    // Grant access to data sources (Athena, Redshift, Glue)
    this.taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        // Athena
        'athena:StartQueryExecution',
        'athena:GetQueryExecution',
        'athena:GetQueryResults',
        'athena:StopQueryExecution',
        // Glue (for Iceberg catalog)
        'glue:GetTable',
        'glue:GetTables',
        'glue:GetDatabase',
        'glue:GetDatabases',
        'glue:GetPartitions',
        // Redshift Data API
        'redshift-data:ExecuteStatement',
        'redshift-data:DescribeStatement',
        'redshift-data:GetStatementResult',
        'redshift-data:ListStatements',
        // Redshift Serverless
        'redshift-serverless:GetCredentials',
      ],
      resources: ['*'], // Data source access is broad - refine based on specific resources
    }));

    // Grant S3 read access for data sources and Athena results
    this.taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:ListBucket',
        's3:GetBucketLocation',
      ],
      resources: ['*'], // Needs access to customer data buckets - refine in production
    }));

    // CloudWatch log group for profiler tasks
    const logGroup = new logs.LogGroup(this, 'ProfilerLogGroup', {
      logGroupName: '/ecs/profiler',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Task definition with container (2 vCPU, 8GB RAM)
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'ProfilerTaskDef', {
      family: 'profiler-task',
      cpu: 2048, // 2 vCPU
      memoryLimitMiB: 8192, // 8GB RAM
      executionRole: this.taskExecutionRole,
      taskRole: this.taskRole,
    });

    // Reference Supabase secrets (must be created manually or via separate stack)
    const supabaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'SupabaseSecret',
      'profiler/supabase'
    );

    // Add profiler container to task definition
    const container = this.taskDefinition.addContainer('profiler', {
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, 'latest'),
      containerName: 'profiler',
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'profiler',
        logGroup,
      }),
      environment: {
        S3_BUCKET: props.profileResultsBucket.bucketName,
      },
      secrets: {
        SUPABASE_URL: ecs.Secret.fromSecretsManager(supabaseSecret, 'url'),
        SUPABASE_KEY: ecs.Secret.fromSecretsManager(supabaseSecret, 'service_key'),
      },
      essential: true,
    });

    // Step Functions state machine for profiler orchestration
    // States: ValidateInput -> RunProfiler (ECS Task) -> Success (or Fail)

    // Validate input state
    const validateInput = new sfn.Choice(this, 'ValidateInput')
      .when(
        sfn.Condition.and(
          sfn.Condition.isPresent('$.sourceType'),
          sfn.Condition.isPresent('$.database'),
          sfn.Condition.isPresent('$.table'),
          sfn.Condition.isPresent('$.runId')
        ),
        new sfn.Pass(this, 'InputValid', { resultPath: sfn.JsonPath.DISCARD })
      )
      .otherwise(
        new sfn.Fail(this, 'FailInvalidInput', {
          error: 'InvalidInput',
          cause: 'Required fields: sourceType, database, table, runId',
        })
      );

    // ECS RunTask for profiler execution
    const runProfiler = new tasks.EcsRunTask(this, 'RunProfiler', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB, // Wait for task completion
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      launchTarget: new tasks.EcsFargateLaunchTarget({
        platformVersion: ecs.FargatePlatformVersion.LATEST,
      }),
      assignPublicIp: true, // Required for public subnets to access internet
      securityGroups: [this.securityGroup],
      subnets: { subnetType: ec2.SubnetType.PUBLIC },
      containerOverrides: [
        {
          containerDefinition: container,
          environment: [
            { name: 'SOURCE_TYPE', value: sfn.JsonPath.stringAt('$.sourceType') },
            { name: 'DATABASE', value: sfn.JsonPath.stringAt('$.database') },
            { name: 'TABLE', value: sfn.JsonPath.stringAt('$.table') },
            { name: 'CONNECTION_PARAMS', value: sfn.JsonPath.stringAt('$.connectionParams') },
            { name: 'RUN_ID', value: sfn.JsonPath.stringAt('$.runId') },
          ],
        },
      ],
      resultPath: '$.taskResult',
    });

    // Add retry logic for transient failures
    runProfiler.addRetry({
      errors: ['States.TaskFailed', 'ECS.AmazonECSException'],
      interval: cdk.Duration.seconds(30),
      maxAttempts: 2,
      backoffRate: 2,
    });

    // Add catch for failures
    const handleError = new sfn.Pass(this, 'HandleError', {
      comment: 'Error handling - log error details',
      parameters: {
        'error.$': '$.Error',
        'cause.$': '$.Cause',
        'runId.$': '$.runId',
      },
      resultPath: '$.errorInfo',
    });

    const fail = new sfn.Fail(this, 'FailState', {
      error: 'ProfilerFailed',
      cause: 'Profiler execution failed after retries',
    });

    runProfiler.addCatch(handleError, {
      resultPath: '$.errorDetails',
    });

    const success = new sfn.Succeed(this, 'Success');

    // Chain: InputValid -> RunProfiler -> Success
    // Error path: HandleError -> Fail
    validateInput.afterwards().next(runProfiler);
    runProfiler.next(success);
    handleError.next(fail);

    this.stateMachine = new sfn.StateMachine(this, 'ProfilerStateMachine', {
      stateMachineName: 'profiler-workflow',
      definitionBody: sfn.DefinitionBody.fromChainable(validateInput),
      timeout: cdk.Duration.minutes(30),
      tracingEnabled: true,
      logs: {
        destination: new logs.LogGroup(this, 'StateMachineLogGroup', {
          logGroupName: '/aws/stepfunctions/profiler-workflow',
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        level: sfn.LogLevel.ALL,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      exportName: 'ProfilerClusterArn',
      description: 'ARN of the ECS cluster',
    });

    new cdk.CfnOutput(this, 'TaskDefinitionArn', {
      value: this.taskDefinition.taskDefinitionArn,
      exportName: 'ProfilerTaskDefinitionArn',
      description: 'ARN of the Fargate task definition',
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      exportName: 'ProfilerStateMachineArn',
      description: 'ARN of the Step Functions state machine',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      exportName: 'ProfilerVpcId',
      description: 'VPC ID for the profiler infrastructure',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      exportName: 'ProfilerEcrRepositoryUri',
      description: 'URI for the profiler ECR repository',
    });
  }
}
