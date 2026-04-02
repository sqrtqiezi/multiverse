Feature: CLI version command
  As a developer
  I want to check the CLI version
  So that I know which version I'm running

  Scenario: Display version
    When I run the CLI with "--version"
    Then the output should be "multiverse 0.0.1"
