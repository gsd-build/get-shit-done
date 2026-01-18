import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * AlertingStack: Creates infrastructure for data quality alerting.
 *
 * Resources:
 * - Lambda function for alert processing
 * - Lambda function for freshness monitoring (scheduled)
 * - EventBridge rules for quality events
 * - SNS topic for error notifications
 */
export class AlertingStack extends cdk.Stack {
  /** Lambda function for alert processing */
  public readonly alertHandler: lambda.Function;
  /** Lambda function for freshness monitoring */
  public readonly freshnessMonitor: lambda.Function;
  /** SNS topic for DQ alerts */
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference Supabase secrets
    const supabaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'SupabaseSecret',
      'profiler/supabase'
    );

    // SNS topic for DQ alerts (for downstream integrations)
    this.alertTopic = new sns.Topic(this, 'DQAlertTopic', {
      topicName: 'dq-alerts',
      displayName: 'Data Quality Alerts',
    });

    // =========================================================================
    // Alert Handler Lambda
    // =========================================================================
    const alertHandlerLogGroup = new logs.LogGroup(this, 'AlertHandlerLogGroup', {
      logGroupName: '/aws/lambda/dq-alert-handler',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.alertHandler = new lambda.Function(this, 'AlertHandler', {
      functionName: 'dq-alert-handler',
      description: 'Processes data quality alerts from EventBridge',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../lambdas/alert_handler'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'dq-alert-handler',
        POWERTOOLS_LOG_LEVEL: 'INFO',
        EVENT_BUS_NAME: 'default',
      },
      logGroup: alertHandlerLogGroup,
    });

    // Grant Lambda permission to read Supabase secrets
    supabaseSecret.grantRead(this.alertHandler);
    this.alertHandler.addEnvironment('SUPABASE_SECRET_NAME', 'profiler/supabase');

    // Grant EventBridge permissions
    this.alertHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: ['*'],
      })
    );

    // =========================================================================
    // Freshness Monitor Lambda
    // =========================================================================
    const freshnessMonitorLogGroup = new logs.LogGroup(this, 'FreshnessMonitorLogGroup', {
      logGroupName: '/aws/lambda/dq-freshness-monitor',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.freshnessMonitor = new lambda.Function(this, 'FreshnessMonitor', {
      functionName: 'dq-freshness-monitor',
      description: 'Scheduled check for data freshness and volume anomalies',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../lambdas/freshness_monitor'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'dq-freshness-monitor',
        POWERTOOLS_LOG_LEVEL: 'INFO',
        EVENT_BUS_NAME: 'default',
      },
      logGroup: freshnessMonitorLogGroup,
    });

    // Grant Lambda permission to read Supabase secrets
    supabaseSecret.grantRead(this.freshnessMonitor);
    this.freshnessMonitor.addEnvironment('SUPABASE_SECRET_NAME', 'profiler/supabase');

    // Grant Glue catalog permissions for freshness checks
    this.freshnessMonitor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'glue:GetTable',
          'glue:GetTables',
          'glue:GetDatabase',
        ],
        resources: ['*'],
      })
    );

    // Grant EventBridge permissions
    this.freshnessMonitor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: ['*'],
      })
    );

    // =========================================================================
    // EventBridge Rules
    // =========================================================================

    // Rule: QualityCheckFailed -> AlertHandler
    const qualityCheckFailedRule = new events.Rule(this, 'QualityCheckFailedRule', {
      ruleName: 'dq-quality-check-failed',
      description: 'Routes quality check failure events to alert handler',
      eventPattern: {
        source: ['data-quality.validator'],
        detailType: ['QualityCheckFailed'],
      },
    });
    qualityCheckFailedRule.addTarget(
      new targets.LambdaFunction(this.alertHandler, {
        retryAttempts: 2,
      })
    );

    // Rule: FreshnessSLAViolation -> AlertHandler
    const freshnessSlaRule = new events.Rule(this, 'FreshnessSLAViolationRule', {
      ruleName: 'dq-freshness-sla-violation',
      description: 'Routes freshness SLA violation events to alert handler',
      eventPattern: {
        source: ['data-quality.freshness'],
        detailType: ['FreshnessSLAViolation'],
      },
    });
    freshnessSlaRule.addTarget(
      new targets.LambdaFunction(this.alertHandler, {
        retryAttempts: 2,
      })
    );

    // Rule: VolumeAnomaly -> AlertHandler
    const volumeAnomalyRule = new events.Rule(this, 'VolumeAnomalyRule', {
      ruleName: 'dq-volume-anomaly',
      description: 'Routes volume anomaly events to alert handler',
      eventPattern: {
        source: ['data-quality.freshness'],
        detailType: ['VolumeAnomaly'],
      },
    });
    volumeAnomalyRule.addTarget(
      new targets.LambdaFunction(this.alertHandler, {
        retryAttempts: 2,
      })
    );

    // Rule: Scheduled freshness check (every 15 minutes)
    const freshnessScheduleRule = new events.Rule(this, 'FreshnessScheduleRule', {
      ruleName: 'dq-freshness-schedule',
      description: 'Triggers freshness monitor every 15 minutes',
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
    });
    freshnessScheduleRule.addTarget(
      new targets.LambdaFunction(this.freshnessMonitor, {
        retryAttempts: 2,
      })
    );

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'AlertHandlerArn', {
      value: this.alertHandler.functionArn,
      exportName: 'DQAlertHandlerArn',
      description: 'ARN of the alert handler Lambda function',
    });

    new cdk.CfnOutput(this, 'FreshnessMonitorArn', {
      value: this.freshnessMonitor.functionArn,
      exportName: 'DQFreshnessMonitorArn',
      description: 'ARN of the freshness monitor Lambda function',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      exportName: 'DQAlertTopicArn',
      description: 'ARN of the DQ alerts SNS topic',
    });
  }
}
