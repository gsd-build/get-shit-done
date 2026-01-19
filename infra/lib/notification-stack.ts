import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

/**
 * Props for NotificationStack
 */
export interface NotificationStackProps extends cdk.StackProps {
  /** Optional: Reference to AlertingStack for cross-stack dependencies */
  alertingStackRef?: cdk.Stack;
}

/**
 * NotificationStack: Creates notification infrastructure for data quality alerts.
 *
 * Resources:
 * - Slack notifier Lambda (subscribes to AlertCreated events)
 * - Email notifier Lambda (subscribes to AlertCreated events)
 * - EventBridge rules for AlertCreated event routing
 * - SSM Parameter for Slack webhook URL storage
 */
export class NotificationStack extends cdk.Stack {
  /** Lambda function for Slack notifications */
  public readonly slackNotifier: lambda.Function;
  /** Lambda function for email notifications */
  public readonly emailNotifier: lambda.Function;

  constructor(scope: Construct, id: string, props?: NotificationStackProps) {
    super(scope, id, props);

    // =========================================================================
    // SSM Parameter for Slack Webhook URL
    // User must populate this parameter after deployment
    // =========================================================================
    const slackWebhookParam = new ssm.StringParameter(this, 'SlackWebhookParam', {
      parameterName: '/data-foundations/slack-webhook-url',
      stringValue: 'https://hooks.slack.com/services/placeholder',
      description: 'Slack incoming webhook URL for DQ alerts. Replace placeholder after deployment.',
      tier: ssm.ParameterTier.STANDARD,
    });

    // =========================================================================
    // Slack Notifier Lambda
    // =========================================================================
    const slackNotifierLogGroup = new logs.LogGroup(this, 'SlackNotifierLogGroup', {
      logGroupName: '/aws/lambda/dq-slack-notifier',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.slackNotifier = new lambda.Function(this, 'SlackNotifier', {
      functionName: 'dq-slack-notifier',
      description: 'Sends data quality alert notifications to Slack via webhook',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../lambdas/slack_notifier'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'dq-slack-notifier',
        POWERTOOLS_LOG_LEVEL: 'INFO',
      },
      logGroup: slackNotifierLogGroup,
    });

    // Grant Lambda permission to read Slack webhook URL from SSM
    slackWebhookParam.grantRead(this.slackNotifier);
    this.slackNotifier.addEnvironment('SLACK_WEBHOOK_PARAM', slackWebhookParam.parameterName);

    // Also set the SLACK_WEBHOOK_URL from SSM parameter at runtime
    // Note: Lambda will need to fetch this from SSM or use environment variable
    // For simplicity, we'll use a dynamic reference
    this.slackNotifier.addEnvironment(
      'SLACK_WEBHOOK_URL',
      ssm.StringParameter.valueForStringParameter(this, '/data-foundations/slack-webhook-url')
    );

    // =========================================================================
    // Email Notifier Lambda
    // =========================================================================
    const emailNotifierLogGroup = new logs.LogGroup(this, 'EmailNotifierLogGroup', {
      logGroupName: '/aws/lambda/dq-email-notifier',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.emailNotifier = new lambda.Function(this, 'EmailNotifier', {
      functionName: 'dq-email-notifier',
      description: 'Sends data quality alert notifications via AWS SES',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../lambdas/email_notifier'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'dq-email-notifier',
        POWERTOOLS_LOG_LEVEL: 'INFO',
        // User must set these via Lambda console or parameter store after deployment
        ALERT_EMAIL_RECIPIENTS: '', // Comma-separated list
        SES_SENDER_EMAIL: '', // Verified SES sender email
      },
      logGroup: emailNotifierLogGroup,
    });

    // Grant SES send permissions
    this.emailNotifier.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // =========================================================================
    // EventBridge Rules for AlertCreated Events
    // =========================================================================

    // Rule: AlertCreated -> Slack Notifier
    const slackNotifyRule = new events.Rule(this, 'AlertSlackNotifyRule', {
      ruleName: 'dq-alert-slack-notify',
      description: 'Routes AlertCreated events to Slack notifier Lambda',
      eventPattern: {
        source: ['data-quality.alerts'],
        detailType: ['AlertCreated'],
      },
    });

    slackNotifyRule.addTarget(
      new targets.LambdaFunction(this.slackNotifier, {
        retryAttempts: 2,
      })
    );

    // Rule: AlertCreated -> Email Notifier
    const emailNotifyRule = new events.Rule(this, 'AlertEmailNotifyRule', {
      ruleName: 'dq-alert-email-notify',
      description: 'Routes AlertCreated events to email notifier Lambda',
      eventPattern: {
        source: ['data-quality.alerts'],
        detailType: ['AlertCreated'],
      },
    });

    emailNotifyRule.addTarget(
      new targets.LambdaFunction(this.emailNotifier, {
        retryAttempts: 2,
      })
    );

    // =========================================================================
    // Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'SlackNotifierArn', {
      value: this.slackNotifier.functionArn,
      exportName: 'DQSlackNotifierArn',
      description: 'ARN of the Slack notifier Lambda function',
    });

    new cdk.CfnOutput(this, 'EmailNotifierArn', {
      value: this.emailNotifier.functionArn,
      exportName: 'DQEmailNotifierArn',
      description: 'ARN of the email notifier Lambda function',
    });

    new cdk.CfnOutput(this, 'SlackWebhookParamName', {
      value: slackWebhookParam.parameterName,
      description: 'SSM Parameter name for Slack webhook URL - update with your webhook',
    });
  }
}
