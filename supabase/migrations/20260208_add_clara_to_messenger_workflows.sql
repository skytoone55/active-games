-- Migration: Add Clara AI integration to messenger workflows
-- Date: 2026-02-08

-- Add Clara fields to messenger_workflow_steps
ALTER TABLE messenger_workflow_steps
ADD COLUMN clara_enabled boolean DEFAULT false,
ADD COLUMN clara_prompt text,
ADD COLUMN clara_model text DEFAULT 'gpt-4o-mini',
ADD COLUMN clara_temperature numeric(3,2) DEFAULT 0.7,
ADD COLUMN clara_timeout_ms integer DEFAULT 5000;

-- Add constraints
ALTER TABLE messenger_workflow_steps
ADD CONSTRAINT check_clara_model CHECK (clara_model IN ('gpt-4o-mini', 'gpt-4o')),
ADD CONSTRAINT check_clara_temperature CHECK (clara_temperature >= 0 AND clara_temperature <= 2),
ADD CONSTRAINT check_clara_timeout CHECK (clara_timeout_ms > 0);

-- Create index for Clara-enabled steps
CREATE INDEX idx_messenger_workflow_steps_clara_enabled
ON messenger_workflow_steps(clara_enabled) WHERE clara_enabled = true;

-- Add global Clara settings to messenger_workflows
ALTER TABLE messenger_workflows
ADD COLUMN clara_default_prompt text,
ADD COLUMN clara_fallback_action text DEFAULT 'escalate',
ADD COLUMN clara_fallback_message text;

-- Add constraint for fallback action
ALTER TABLE messenger_workflows
ADD CONSTRAINT check_clara_fallback_action CHECK (clara_fallback_action IN ('escalate', 'retry', 'abort'));
