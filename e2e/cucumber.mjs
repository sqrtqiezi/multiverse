export default {
  import: ['tsx'],
  paths: ['features/**/*.feature'],
  require: ['features/step_definitions/**/*.ts'],
  requireModule: ['tsx'],
  format: [
    'progress',
    'summary',
    'html:reports/cucumber-report.html',
    'rerun:reports/rerun.txt',
  ],
};
