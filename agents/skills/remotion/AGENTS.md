# AGENTS.md - @remotion/skills

This is an internal Remotion package for video creation skills. Refer to the [Remotion documentation](https://www.remotion.dev/docs) for domain-specific knowledge.

## Build Commands

```bash
# Start the Remotion Studio for local development
npm run dev

# Install dependencies
npm install
```

## Code Style Guidelines

### TypeScript
- Use TypeScript for all files (.ts, .tsx)
- Use React.FC for component types when needed
- Enable strict mode (inherited from parent tsconfig.settings.json)
- No `any` types - use explicit types or `unknown` where appropriate

### Formatting (Prettier)
- Tab width: 2 spaces
- Use spaces (no tabs)
- Bracket spacing: enabled
- Import prettier and run: `npx prettier --write .`

### React Components
- Use functional components with hooks
- Use composition pattern with `Composition` from 'remotion' for defining videos
- Export components as named exports
- Component naming: PascalCase for components, camelCase for variables/functions

### Imports
```typescript
import {Composition, useCurrentFrame, useVideoConfig, spring, AbsoluteFill} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Inter';
import {SomeComponent} from './path/to/component';
```

### Remotion-Specific Patterns
- Define compositions with explicit durationInFrames, fps, width, height
- Use `useCurrentFrame()` for frame-based animations
- Use `useVideoConfig()` to access fps, duration, dimensions
- Use `spring()` for smooth animations (damping, stiffness config)
- Use `AbsoluteFill` for full-bleed composition backgrounds
- Default composition sizes: 1920x1080 (1080p), 1280x720 (720p)

### Styling
- Use inline style objects for Remotion components (required for server-side rendering)
- Use flexbox for layouts
- Define color constants at module level (UPPER_SNAKE_CASE)
- Font loading: Use @remotion/google-fonts packages

### Constants
```typescript
const COLOR_PRIMARY = '#D4AF37';
const COLOR_TEXT = '#ffffff';
const COLOR_BG = '#0a0a0a';
```

### Naming Conventions
- Components: PascalCase (e.g., `BarChartAnimation`, `MyAnimation`)
- Variables/functions: camelCase (e.g., `useCurrentFrame`, `barHeight`)
- Constants: UPPER_SNAKE_CASE (e.g., `COLOR_BAR`, `FPS_DEFAULT`)
- Props interfaces: PascalCase with `Props` suffix (e.g., `BarProps`)

### Error Handling
- Use TypeScript types for validation
- Define Zod schemas for composition parameters (see rules/parameters.md)
- Handle null/undefined cases explicitly

### File Organization
```
src/
  index.ts           # registerRoot()
  Root.tsx           # Composition definitions
skills/remotion/
  rules/             # Skill documentation
  SKILL.md          # Skills index
  assets/           # Animation component examples
```

### ESLint
- Uses @remotion/eslint-config-internal
- Run linting: Check parent repository for lint commands
- Fix auto-fixable issues: ESLint may auto-fix on save

### Testing
- This package currently has no test files
- Check parent repository for testing patterns (typically Jest/Vitest)
- Test files should match: *.test.{ts,tsx,js,jsx} or *.spec.{ts,tsx,js,jsx}

### Additional Resources
- See skills/remotion/SKILL.md for Remotion best practices
- See skills/remotion/rules/ for detailed guidelines on:
  - 3D content (Three.js/React Three Fiber)
  - Animations and timing
  - Audio/video handling
  - Charts and data visualization
  - Text animations and typography
  - Transitions and sequencing

## Git Workflow
- Create feature branches for changes
- Commit messages: follow conventional commits format
- No force pushes to main/master
- Run lint/typecheck before committing (check parent repository)
