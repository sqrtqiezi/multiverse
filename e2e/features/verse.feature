Feature: Verse persistence for start runs
  As a developer
  I want each branch to reuse its verse-bound Claude Code environment
  So that repeated starts do not re-run Claude initialization

  Background:
    Given Docker is available
    And Claude credentials exist
    And Ollama Anthropic-compatible API is available
    And marker-writing prompt mode is enabled

  Scenario: First successful start creates verse file and environment directory
    Given verse file for current branch should not exist
    When I run "multiverse start"
    Then the exit code should be 0
    And verse file for current branch should exist
    And current branch verse should include environment metadata
    And current branch verse environment directory should exist
    And current branch verse environment directory should contain the expected marker

  Scenario: Second successful start reuses the same verse environment
    Given verse file for current branch should not exist
    When I run "multiverse start"
    Then the exit code should be 0
    And current branch verse environment directory should contain the expected marker
    And remember the current branch verse environment path
    And remember the current branch verse environment marker
    When I run "multiverse start"
    Then the exit code should be 0
    And current branch verse should reuse the remembered environment path
    And current branch verse environment directory should contain the remembered marker
    And verse file for current branch should have one more run
    And latest run in current branch verse should contain finish fields

  Scenario: Start after container cleanup still reuses the same verse environment
    Given verse file for current branch should not exist
    When I run "multiverse start"
    Then the exit code should be 0
    And current branch verse environment directory should contain the expected marker
    And remember the current branch verse environment marker
    And remember the current branch verse environment path
    And the recorded multiverse containers are removed
    When I run "multiverse start"
    Then the exit code should be 0
    And current branch verse should reuse the remembered environment path
    And current branch verse environment directory should contain the remembered marker
