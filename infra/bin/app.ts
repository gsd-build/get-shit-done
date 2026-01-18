#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { ProfilerStack } from '../lib/profiler-stack';

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
