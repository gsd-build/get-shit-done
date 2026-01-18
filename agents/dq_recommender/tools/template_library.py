"""
Rule Template Library for the DQ Recommender Agent.

Provides pre-defined industry-standard rule templates that can be
applied to columns without AI generation.
"""

import json
from typing import Optional

# Template categories
CATEGORY_FORMAT = "format"
CATEGORY_RANGE = "range"
CATEGORY_CONSISTENCY = "consistency"
CATEGORY_COMPLIANCE = "compliance"

# Pre-defined rule templates following industry patterns
# Note: Use doubled braces {{}} to escape regex quantifiers from Python .format()
RULE_TEMPLATES = {
    # Format validation templates
    "email_validity": {
        "name": "email_validity",
        "category": CATEGORY_FORMAT,
        "description": "Validates email addresses match standard format",
        "dqdl_pattern": 'ColumnValues "{col}" matches "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{{2,}}"',
        "parameters": [],
        "industry_standards": ["RFC 5322"]
    },
    "date_format_iso": {
        "name": "date_format_iso",
        "category": CATEGORY_FORMAT,
        "description": "Validates ISO 8601 date format (YYYY-MM-DD)",
        "dqdl_pattern": 'ColumnValues "{col}" matches "\\\\d{{4}}-\\\\d{{2}}-\\\\d{{2}}"',
        "parameters": [],
        "industry_standards": ["ISO 8601"]
    },
    "phone_us": {
        "name": "phone_us",
        "category": CATEGORY_FORMAT,
        "description": "Validates US phone number formats",
        "dqdl_pattern": 'ColumnValues "{col}" matches "^\\\\+?1?[-.\\\\s]?\\\\(?\\\\d{{3}}\\\\)?[-.\\\\s]?\\\\d{{3}}[-.\\\\s]?\\\\d{{4}}$"',
        "parameters": [],
        "industry_standards": ["E.164", "NANP"]
    },
    "ssn_format": {
        "name": "ssn_format",
        "category": CATEGORY_COMPLIANCE,
        "description": "Validates US Social Security Number format (XXX-XX-XXXX)",
        "dqdl_pattern": 'ColumnValues "{col}" matches "^\\\\d{{3}}-\\\\d{{2}}-\\\\d{{4}}$"',
        "parameters": [],
        "industry_standards": ["SSA", "IRS"]
    },
    "uuid_format": {
        "name": "uuid_format",
        "category": CATEGORY_FORMAT,
        "description": "Validates UUID v4 format",
        "dqdl_pattern": 'ColumnValues "{col}" matches "^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$"',
        "parameters": [],
        "industry_standards": ["RFC 4122"]
    },
    "currency_precision": {
        "name": "currency_precision",
        "category": CATEGORY_FORMAT,
        "description": "Validates currency values have exactly 2 decimal places",
        "dqdl_pattern": 'ColumnValues "{col}" matches "^\\\\d+\\\\.\\\\d{{2}}$"',
        "parameters": [],
        "industry_standards": ["ISO 4217"]
    },
    # Range validation templates
    "positive_number": {
        "name": "positive_number",
        "category": CATEGORY_RANGE,
        "description": "Ensures values are positive (greater than 0)",
        "dqdl_pattern": 'ColumnValues "{col}" > 0',
        "parameters": [],
        "industry_standards": []
    },
    "percentage_range": {
        "name": "percentage_range",
        "category": CATEGORY_RANGE,
        "description": "Ensures values are between 0 and 100 (percentage)",
        "dqdl_pattern": 'ColumnValues "{col}" between 0 and 100',
        "parameters": [],
        "industry_standards": []
    },
    "custom_range": {
        "name": "custom_range",
        "category": CATEGORY_RANGE,
        "description": "Ensures values are within a custom range",
        "dqdl_pattern": 'ColumnValues "{col}" between {min_value} and {max_value}',
        "parameters": [
            {"name": "min_value", "type": "number", "required": True, "description": "Minimum allowed value"},
            {"name": "max_value", "type": "number", "required": True, "description": "Maximum allowed value"}
        ],
        "industry_standards": []
    },
    # Consistency templates
    "not_null": {
        "name": "not_null",
        "category": CATEGORY_CONSISTENCY,
        "description": "Ensures column has no null values (completeness)",
        "dqdl_pattern": 'IsComplete "{col}"',
        "parameters": [],
        "industry_standards": []
    },
    "unique_values": {
        "name": "unique_values",
        "category": CATEGORY_CONSISTENCY,
        "description": "Ensures all values in column are unique",
        "dqdl_pattern": 'IsUnique "{col}"',
        "parameters": [],
        "industry_standards": []
    },
    "referential_integrity": {
        "name": "referential_integrity",
        "category": CATEGORY_CONSISTENCY,
        "description": "Ensures values exist in a reference table",
        "dqdl_pattern": 'ReferentialIntegrity "{col}" "{ref_table}.{ref_col}"',
        "parameters": [
            {"name": "ref_table", "type": "string", "required": True, "description": "Reference table name"},
            {"name": "ref_col", "type": "string", "required": True, "description": "Reference column name"}
        ],
        "industry_standards": []
    },
    # Freshness templates
    "data_freshness": {
        "name": "data_freshness",
        "category": CATEGORY_CONSISTENCY,
        "description": "Ensures data is not older than specified hours",
        "dqdl_pattern": 'DataFreshness "{col}" <= {max_age_hours} hours',
        "parameters": [
            {"name": "max_age_hours", "type": "number", "required": True, "description": "Maximum age in hours"}
        ],
        "industry_standards": []
    },
}


def apply_rule_template(
    template_name: str,
    column_name: str,
    parameters: str = "{}"
) -> str:
    """
    Apply a pre-defined rule template to a column.

    Templates provide consistent, validated DQDL rules for common patterns
    without requiring AI generation.

    Args:
        template_name: Name of the template to apply
            (e.g., 'email_validity', 'positive_number', 'not_null')
        column_name: Column to apply the rule to
        parameters: JSON string with template parameters
            (e.g., '{"min_value": 0, "max_value": 100}')

    Returns:
        JSON string with:
        - template: Template name used
        - rule: Generated DQDL rule
        - column: Column name
        - description: Template description
    """
    if template_name not in RULE_TEMPLATES:
        available = ", ".join(sorted(RULE_TEMPLATES.keys()))
        return json.dumps({
            "success": False,
            "error": f"Unknown template: {template_name}",
            "available_templates": available
        })

    template = RULE_TEMPLATES[template_name]

    # Parse parameters
    try:
        params = json.loads(parameters) if isinstance(parameters, str) else parameters
    except json.JSONDecodeError as e:
        return json.dumps({
            "success": False,
            "error": f"Invalid parameters JSON: {str(e)}"
        })

    # Check required parameters
    for param_def in template.get("parameters", []):
        if param_def.get("required", False) and param_def["name"] not in params:
            return json.dumps({
                "success": False,
                "error": f"Missing required parameter: {param_def['name']}",
                "template": template_name,
                "parameters": template.get("parameters", [])
            })

    # Generate rule from template
    try:
        rule = template["dqdl_pattern"].format(col=column_name, **params)
    except KeyError as e:
        return json.dumps({
            "success": False,
            "error": f"Missing parameter for template: {str(e)}",
            "template": template_name,
            "parameters": template.get("parameters", [])
        })

    return json.dumps({
        "success": True,
        "template": template_name,
        "rule": rule,
        "column": column_name,
        "description": template["description"],
        "category": template["category"],
        "industry_standards": template.get("industry_standards", [])
    })


def list_templates(category: Optional[str] = None) -> str:
    """
    List available rule templates, optionally filtered by category.

    Args:
        category: Optional category filter
            (format, range, consistency, compliance)

    Returns:
        JSON string with list of templates and their metadata
    """
    templates = []

    for name, template in RULE_TEMPLATES.items():
        if category and template["category"] != category:
            continue

        templates.append({
            "name": name,
            "category": template["category"],
            "description": template["description"],
            "has_parameters": len(template.get("parameters", [])) > 0,
            "parameters": template.get("parameters", []),
            "industry_standards": template.get("industry_standards", [])
        })

    # Sort by category then name
    templates.sort(key=lambda t: (t["category"], t["name"]))

    categories = sorted(set(t["category"] for t in RULE_TEMPLATES.values()))

    return json.dumps({
        "success": True,
        "templates": templates,
        "total_count": len(templates),
        "categories": categories,
        "filter_applied": category
    })


# Make functions Strands tools
try:
    from strands import tool
    apply_rule_template = tool(apply_rule_template)
    list_templates = tool(list_templates)
except ImportError:
    # Allow module to work without strands for testing
    pass
