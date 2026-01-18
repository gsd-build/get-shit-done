import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * DataStack: Creates shared data resources for the Data Foundations platform.
 *
 * Resources:
 * - S3 bucket for storing full profile JSON files
 * - Lifecycle policies for cost optimization
 */
export class DataStack extends cdk.Stack {
  /** S3 bucket for storing profile results */
  public readonly profileResultsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for storing full profile JSON files
    // Profile results can be large (10-50MB per table), stored here to avoid PostgreSQL bloat
    this.profileResultsBucket = new s3.Bucket(this, 'ProfileResultsBucket', {
      bucketName: `profile-results-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false, // Profile results are immutable, no versioning needed

      // Lifecycle rules for cost optimization
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
        {
          id: 'ExpireOldProfiles',
          enabled: true,
          expiration: cdk.Duration.days(365),
        },
      ],
    });

    // Export bucket ARN for cross-stack reference
    new cdk.CfnOutput(this, 'ProfileResultsBucketArn', {
      value: this.profileResultsBucket.bucketArn,
      exportName: 'ProfileResultsBucketArn',
      description: 'ARN of the S3 bucket for profile results',
    });

    new cdk.CfnOutput(this, 'ProfileResultsBucketName', {
      value: this.profileResultsBucket.bucketName,
      exportName: 'ProfileResultsBucketName',
      description: 'Name of the S3 bucket for profile results',
    });
  }
}
