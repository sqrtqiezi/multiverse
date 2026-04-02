export default {
  import: ['tsx'],
  paths: ['features/**/*.feature'],
  require: ['features/step_definitions/**/*.ts'],
  requireModule: ['tsx'],
  format: ['progress-bar', 'html:reports/cucumber-report.html'],
};
