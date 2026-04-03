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

  Scenario: Start container and complete a real Ollama-backed Claude request
    Given Docker is available
    And Claude credentials exist
    And Ollama Anthropic-compatible API is available
    When I run "multiverse start"
    Then the output should contain "Container started"
    And the output should contain "E2E_OLLAMA_OK_20260403"
    And the exit code should be 0
