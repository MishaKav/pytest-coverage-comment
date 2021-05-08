const fs = require('fs');
const path = require('path');
const { toHtml } = require('./parse');

const main = async () => {
  const file = process.argv[2];
  const prefix = path.dirname(path.dirname(path.resolve(file))) + '/';

  const options = {
    repository: 'MishaKav/pytest-coverage-comment',
    commit: 'f9d42291812ed03bb197e48050ac38ac6befe4e5',
    prefix,
    head: 'feat/test',
    base: 'main',
    title: 'Coverage Report',
    badgeTitle: 'Coverage',
    hideBadge: false,
    hideReport: false,
  };

  const content = fs.readFileSync(__dirname + file, 'utf8');
  const result = toHtml(content, options);

  const resultFile = __dirname + '/tmp/comment.md';
  fs.writeFileSync(resultFile, result);
  console.log(resultFile);
};

main().catch(function (err) {
  console.log(err);
  process.exit(1);
});
