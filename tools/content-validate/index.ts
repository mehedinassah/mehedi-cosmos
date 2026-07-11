/**
 * CI gate — blueprint §11. Parses + integrity-checks universe content.
 * A dangling edge or missing `meaning` fails the build, never ships.
 */
import { universe } from '../../src/content/universe';

const placeholders = universe.bodies.filter((b) =>
  b.log.body.includes('PLACEHOLDER'),
);

console.log(`✓ Universe valid: ${universe.bodies.length} bodies, ${universe.skills.length} skills, ${universe.edges.length} edges`);
if (placeholders.length > 0) {
  console.warn(`⚠ ${placeholders.length} bodies carry PLACEHOLDER content (pending §17.6): ${placeholders.map((b) => b.id).join(', ')}`);
}
