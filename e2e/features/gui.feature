@gui
Feature: GUI configuration management
  As a developer
  I want to view and edit configurations through a GUI
  So that I can visually manage agent settings

  Background:
    Given a Tauri GUI application is running
    And a default template with CLAUDE.md exists

  Scenario: Application launches successfully
    Then the window title should be "Multiverse"
    And the sidebar should be visible
    And no runtime error notification should appear

  Scenario: View configuration file tree
    Then the sidebar should display "模板: default" group
    And the sidebar should contain "CLAUDE.md"

  Scenario: Create a template config when no config files exist
    Given the default template has no config files
    Then the sidebar should offer to create "CLAUDE.md"

  Scenario: View CLAUDE.md content
    When I click "CLAUDE.md" in the sidebar
    Then the editor should display the contents of CLAUDE.md

  Scenario: Edit and save CLAUDE.md
    Given CLAUDE.md contains "# Original Content"
    When I click "CLAUDE.md" in the sidebar
    And I clear the editor and type "# Modified Content"
    And I click the save button
    Then a success notification should appear
    And the file CLAUDE.md should contain "# Modified Content"
