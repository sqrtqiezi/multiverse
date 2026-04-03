Feature: Zero-config container start
  As a developer
  I want to run "multiverse start" without any configuration
  So that I can quickly start using claude-code

  Scenario: Docker is not available
    Given Docker is not running
    When I run "multiverse start"
    Then the output should contain "Docker is not available"
    And the exit code should be 1

  Scenario: Credentials not found
    Given Docker is available
    And Claude credentials do not exist
    When I run "multiverse start"
    Then the output should contain "Claude credentials not found"
    And the exit code should be 1

  Scenario: Start container successfully
    Given Docker is available
    And Claude credentials exist
    When I run "multiverse start"
    Then the output should contain "Container started"
    And the output should contain "Entering claude-code interactive mode"
