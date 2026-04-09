Feature: Template creation and listing
  As a developer
  I want to create and list configuration templates
  So that I can reuse configurations across projects

  Background:
    Given a valid Claude home directory exists

  Scenario: Create a template from global configuration
    When I run "multiverse template create my-test-template"
    Then the exit code should be 0
    And the output should contain "my-test-template"
    And a template file should exist in the templates directory

  Scenario: List templates shows created template
    Given I have created a template named "list-test"
    When I run "multiverse template list"
    Then the exit code should be 0
    And the output should contain "list-test"

  Scenario: Reject duplicate template name
    Given I have created a template named "dup-name"
    When I run "multiverse template create dup-name"
    Then the exit code should be 1
    And the output should contain "already exists"

  Scenario: List templates as JSON
    Given I have created a template named "json-test"
    When I run "multiverse template list --json"
    Then the exit code should be 0
    And the output should be valid JSON
    And the JSON output should contain a template named "json-test"
