Feature: Zero-config container start
  As a developer
  I want to run "multiverse start" without any configuration
  So that I can quickly start using claude-code

  Scenario: Docker is not available
    Given Docker is not running
    When I run "multiverse start"
    Then the output should contain "Docker 不可用"
    And the output should contain "docker --version"
    And the exit code should be 1

  Scenario: Credentials not found
    Given Docker is available
    And Claude credentials do not exist
    When I run "multiverse start"
    Then the output should contain "Claude 凭证未找到"
    And the exit code should be 1

  Scenario: Start with non-existent template
    Given Docker is available
    And Claude credentials exist
    When I run "multiverse start --template no-such-template"
    Then the output should contain "Template \"no-such-template\" not found"
    And the exit code should be 1

  Scenario: Start with existing template
    Given Docker is available
    And Claude credentials exist
    And Ollama Anthropic-compatible API is available
    And a template named "e2e-start-tpl" exists
    When I run "multiverse start --template e2e-start-tpl"
    Then the output should contain "configuration injected"
    And the output should contain "Container started"
    And the exit code should be 0
    And current branch verse should have a templateId
    And current branch verse environment should contain template config files
    And current branch verse environment should contain plugin files with rewritten paths

  Scenario: Start container and complete a real Ollama-backed Claude request
    Given Docker is available
    And Claude credentials exist
    And Ollama Anthropic-compatible API is available
    And a template named "default" exists
    When I run "multiverse start"
    Then the output should contain "Container started"
    And the output should contain "E2E_OLLAMA_OK_20260403"
    And the exit code should be 0
