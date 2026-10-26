// Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.
import type { ScreenReader } from './profiles.ts'

/**
 * The key command cheat sheet. It stays visible while the page is blacked out, opens only from its
 * button, never takes focus, is not a live region, and sits after the main content, so a screen
 * reader only meets it if the tester goes there. Closed, it is `hidden` and out of the tree.
 */
export function CheatSheet({ open, reader }: { open: boolean; reader: ScreenReader }) {
  return (
    <aside id="qa-cheat-sheet" className="card qa-cheat" aria-labelledby="qa-cheat-title" hidden={!open}>
      <h2 id="qa-cheat-title">{reader.name} keys</h2>
      <p className="note">
        From memory, marked as a proposal. Rows marked "check" are the least certain. Vendor list:{' '}
        <a href={reader.docs} target="_blank" rel="noreferrer">
          {reader.name} commands (opens in a new tab)
        </a>
      </p>
      <table className="qa-keys">
        <caption className="sr-only">{reader.name} commands</caption>
        <thead>
          <tr>
            <th scope="col">Keys</th>
            <th scope="col">Does</th>
          </tr>
        </thead>
        <tbody>
          {reader.commands.map((c) => (
            <tr key={c.keys}>
              <th scope="row">
                <kbd>{c.keys}</kbd>
              </th>
              <td>
                {c.action}
                {c.unverified && <span className="qa-check"> (check)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  )
}
