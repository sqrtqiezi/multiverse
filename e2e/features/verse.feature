Feature: Verse persistence for start runs
  As a developer
  I want each start run to be recorded in a branch-scoped verse file
  So that I can inspect run history later

  Background:
    Given Docker is available
    And Claude credentials exist

  Scenario: First successful start creates verse file for current branch
    Given verse file for current branch should not exist
    When I run "multiverse start"
    Then verse file for current branch should exist
    And verse file for current branch has at least 1 run

  Scenario: Second successful start appends another run
    Given verse file for current branch should not exist
    When I run "multiverse start"
    Then verse file for current branch has at least 1 run
    When I run "multiverse start"
    Then verse file for current branch should have one more run

  Scenario: Completed run includes endAt exitCode containerId
    Given verse file for current branch should not exist
    When I run "multiverse start"
    Then verse file for current branch should exist
    And latest run in current branch verse should contain finish fields
