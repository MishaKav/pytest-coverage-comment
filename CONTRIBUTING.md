# Contributing to pytest-coverage-comment

Thanks for your interest in contributing! This document provides guidelines for contributing to this project.

## Development Setup

1. **Fork and clone** the repository
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Make your changes** in the `src/` directory
4. **Build and test**:
   ```bash
   npm run all           # Run lint, format, and build
   # Or run individually:
   npm run lint          # Check code style
   npm run format-check  # Check formatting
   npm run build         # Bundle the action
   ```

## Making Changes

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Follow code style**:
   - Run `npm run lint` before committing
   - Run `npm run format` to auto-format code
   - Follow existing code patterns

3. **Test your changes**:
   - Use `src/cli.js` for local testing
   - Test with actual coverage files when possible

4. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Reference issue numbers when applicable

5. **Submit a Pull Request**:
   - Fill out the PR template
   - Link to related issues
   - Ensure all checks pass

## Reporting Issues

- **Bug reports**: Use the bug report template
- **Feature requests**: Use the feature request template
- **Questions**: Check existing issues or open a discussion

## Code Review Process

- Maintainers will review PRs as time permits
- Address any requested changes
- Once approved, maintainers will merge your PR

## Questions?

See [SUPPORT.md](SUPPORT.md) for ways to get help.

---

**Thank you for contributing!** 🎉
