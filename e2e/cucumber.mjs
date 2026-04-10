const requestedFeaturePaths = process.argv
  .slice(2)
  .filter((arg) => arg !== '--')
  .filter((arg) => arg.endsWith('.feature'))
  .map((arg) => (arg.startsWith('e2e/') ? arg.slice('e2e/'.length) : arg));

export default {
  import: ['tsx'],
  paths: requestedFeaturePaths.length > 0 ? requestedFeaturePaths : ['features/**/*.feature'],
  require: ['features/step_definitions/**/*.ts'],
  requireModule: ['tsx'],
  format: [
    'progress',
    'summary',
    'html:reports/cucumber-report.html',
    'rerun:reports/rerun.txt',
  ],
};
