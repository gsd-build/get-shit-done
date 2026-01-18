'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useCreateSource, CreateSourceInput } from '@/hooks/use-sources';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

const sourceTypes = [
  { value: 'iceberg', label: 'Apache Iceberg' },
  { value: 'redshift', label: 'Amazon Redshift' },
  { value: 'athena', label: 'Amazon Athena' },
];

// Validation schemas
const baseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  source_type: z.enum(['iceberg', 'redshift', 'athena']),
  database_name: z.string().min(1, 'Database name is required'),
  table_name: z.string().min(1, 'Table name is required'),
});

const icebergSchema = z.object({
  region: z.string().min(1, 'Region is required'),
  catalog_name: z.string().min(1, 'Catalog name is required'),
});

const redshiftSchema = z.object({
  workgroup: z.string().min(1, 'Workgroup is required'),
  region: z.string().min(1, 'Region is required'),
});

const athenaSchema = z.object({
  region: z.string().min(1, 'Region is required'),
  output_location: z.string().min(1, 'Output location is required'),
});

export function SourceForm() {
  const router = useRouter();
  const createSource = useCreateSource();

  const [formData, setFormData] = useState({
    name: '',
    source_type: '',
    database_name: '',
    table_name: '',
    // Iceberg
    region: '',
    catalog_name: '',
    // Redshift
    workgroup: '',
    // Athena
    output_location: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Base validation
    const baseResult = baseSchema.safeParse(formData);
    if (!baseResult.success) {
      baseResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
    }

    // Type-specific validation
    if (formData.source_type === 'iceberg') {
      const result = icebergSchema.safeParse(formData);
      if (!result.success) {
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
      }
    } else if (formData.source_type === 'redshift') {
      const result = redshiftSchema.safeParse(formData);
      if (!result.success) {
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
      }
    } else if (formData.source_type === 'athena') {
      const result = athenaSchema.safeParse(formData);
      if (!result.success) {
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Build connection config based on type
    let connection_config: Record<string, unknown> = {};

    if (formData.source_type === 'iceberg') {
      connection_config = {
        region: formData.region,
        catalog_name: formData.catalog_name,
      };
    } else if (formData.source_type === 'redshift') {
      connection_config = {
        workgroup: formData.workgroup,
        region: formData.region,
      };
    } else if (formData.source_type === 'athena') {
      connection_config = {
        region: formData.region,
        output_location: formData.output_location,
      };
    }

    const input: CreateSourceInput = {
      name: formData.name,
      source_type: formData.source_type as 'iceberg' | 'redshift' | 'athena',
      connection_config,
      database_name: formData.database_name,
      table_name: formData.table_name,
    };

    try {
      await createSource.mutateAsync(input);
      router.push('/sources');
    } catch (err) {
      console.error('Failed to create source:', err);
      setErrors({ submit: 'Failed to create source. Please try again.' });
    }
  };

  const renderConnectionFields = () => {
    switch (formData.source_type) {
      case 'iceberg':
        return (
          <>
            <Input
              name="region"
              label="AWS Region"
              placeholder="us-east-1"
              value={formData.region}
              onChange={handleChange}
              error={errors.region}
            />
            <Input
              name="catalog_name"
              label="Glue Catalog Name"
              placeholder="awsdatacatalog"
              value={formData.catalog_name}
              onChange={handleChange}
              error={errors.catalog_name}
            />
          </>
        );
      case 'redshift':
        return (
          <>
            <Input
              name="workgroup"
              label="Redshift Workgroup"
              placeholder="default"
              value={formData.workgroup}
              onChange={handleChange}
              error={errors.workgroup}
            />
            <Input
              name="region"
              label="AWS Region"
              placeholder="us-east-1"
              value={formData.region}
              onChange={handleChange}
              error={errors.region}
            />
          </>
        );
      case 'athena':
        return (
          <>
            <Input
              name="region"
              label="AWS Region"
              placeholder="us-east-1"
              value={formData.region}
              onChange={handleChange}
              error={errors.region}
            />
            <Input
              name="output_location"
              label="Query Output S3 Location"
              placeholder="s3://my-bucket/athena-results/"
              value={formData.output_location}
              onChange={handleChange}
              error={errors.output_location}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Add Data Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.submit && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {errors.submit}
            </div>
          )}

          <Input
            name="name"
            label="Source Name"
            placeholder="My Data Source"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
          />

          <Select
            name="source_type"
            label="Source Type"
            placeholder="Select source type..."
            options={sourceTypes}
            value={formData.source_type}
            onChange={handleChange}
            error={errors.source_type}
          />

          {formData.source_type && (
            <>
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3">Connection Settings</h4>
                <div className="space-y-4">{renderConnectionFields()}</div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3">Dataset</h4>
                <div className="space-y-4">
                  <Input
                    name="database_name"
                    label="Database Name"
                    placeholder="my_database"
                    value={formData.database_name}
                    onChange={handleChange}
                    error={errors.database_name}
                  />
                  <Input
                    name="table_name"
                    label="Table Name"
                    placeholder="my_table"
                    value={formData.table_name}
                    onChange={handleChange}
                    error={errors.table_name}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/sources')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createSource.isPending}>
            {createSource.isPending ? 'Creating...' : 'Create Source'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
