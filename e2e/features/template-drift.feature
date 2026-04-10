@template-drift
Feature: Template drift detection on start
  As a developer
  I want multiverse start to detect when the current config drifts from its template
  So that I can keep, sync, or cancel intentionally

  Scenario: no prompt when config matches template
    Given Docker is available
    And Claude credentials exist
    And the current global config still matches template "default"
    When I run "multiverse start" in scripted mode
    Then the output should not contain "Current global config has drifted from template"
    And the exit code should be 0
    And the current branch verse should still reference template "default"

  Scenario: prompt when CLAUDE.md drifted and user keeps current template
    Given Docker is available
    And Claude credentials exist
    And the current global config drifts from template "default" by changing "CLAUDE.md"
    When I run "multiverse start" in scripted mode with answers:
      """
      1
      """
    Then the output should contain "Current global config has drifted from template"
    And the exit code should be 0
    And the current branch verse should still reference template "default"

  Scenario: sync creates a new template and switches verse when settings.json drifted
    Given Docker is available
    And Claude credentials exist
    And the current global config drifts from template "default" by changing ".claude/settings.json"
    When I run "multiverse start" in scripted mode with answers:
      """
      2
      """
    Then the output should contain "Current global config has drifted from template"
    And the output should contain "Created synced template"
    And the templates directory should contain one more template
    And the current branch verse should reference a template different from "default"

  Scenario: cancel stops start flow
    Given Docker is available
    And Claude credentials exist
    And the current global config drifts from template "default" by changing ".claude/settings.json"
    When I run "multiverse start" in scripted mode with answers:
      """
      3
      """
    Then the output should contain "Current global config has drifted from template"
    And the output should contain "Start cancelled"
    And the exit code should be 0
    And the current branch verse should still reference template "default"
