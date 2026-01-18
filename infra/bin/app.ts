#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { ProfilerStack } from '../lib/profiler-stack';
import { DQRecommenderStack } from '../lib/dq-recommender-stack';
import { ValidatorStack } from '../lib/validator-stack';
import { AlertingStack } from '../lib/alerting-stack';

const app = new cdk.App();

// Environment configuration
// Uses CDK_DEFAULT_ACCOUNT/REGION if not explicitly set
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
};

// DataStack: Shared data resources (S3 bucket)
const dataStack = new DataStack(app, 'DataFoundationsDataStack', {
  env,
  description: 'Data Foundations - Shared data resources (S3 bucket for profile results)',
  tags: {
    Project: 'DataFoundations',
    Component: 'DataStack',
  },
});

// ProfilerStack: Compute infrastructure (VPC, ECS, Step Functions)
// Depends on DataStack for S3 bucket reference
const profilerStack = new ProfilerStack(app, 'DataFoundationsProfilerStack', {
  env,
  profileResultsBucket: dataStack.profileResultsBucket,
  description: 'Data Foundations - Profiler compute infrastructure (VPC, ECS, Step Functions)',
  tags: {
    Project: 'DataFoundations',
    Component: 'ProfilerStack',
  },
});

// Explicit dependency: ProfilerStack depends on DataStack
profilerStack.addDependency(dataStack);

// DQRecommenderStack: DQ Recommender service (Lambda, API Gateway)
const dqRecommenderStack = new DQRecommenderStack(app, 'DataFoundationsDQRecommenderStack', {
  env,
  description: 'Data Foundations - DQ Recommender service (Lambda, API Gateway)',
  tags: {
    Project: 'DataFoundations',
    Component: 'DQRecommenderStack',
  },
});

// ValidatorStack: Validation workflow (Step Functions, Lambda)
// Depends on DQRecommenderStack for approval Lambda
const validatorStack = new ValidatorStack(app, 'DataFoundationsValidatorStack', {
  env,
  approvalHandlerArn: dqRecommenderStack.approvalHandler.functionArn,
  description: 'Data Foundations - Validation workflow (Step Functions, Lambda)',
  tags: {
    Project: 'DataFoundations',
    Component: 'ValidatorStack',
  },
});

// Explicit dependency: ValidatorStack depends on DQRecommenderStack
validatorStack.addDependency(dqRecommenderStack);

// AlertingStack: Alerting infrastructure (EventBridge, Lambda)
// Depends on ValidatorStack for EventBridge event sources
const alertingStack = new AlertingStack(app, 'DataFoundationsAlertingStack', {
  env,
  description: 'Data Foundations - Alerting infrastructure (EventBridge, Lambda)',
  tags: {
    Project: 'DataFoundations',
    Component: 'AlertingStack',
  },
});

// Explicit dependency: AlertingStack depends on ValidatorStack
alertingStack.addDependency(validatorStack);
