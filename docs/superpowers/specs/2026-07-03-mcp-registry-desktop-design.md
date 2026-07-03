# MCP Registry Desktop Design

## Goal

Build a Windows desktop app that manages the AI connection points for CAD and Revit.

The first version is not trying to fully automate CAD-to-Revit work yet. Its job is to prepare the foundation:

- Register the CAD connection.
- Register the Revit connection.
- Show whether each connection is available.
- Store the port, URL, launch command, and memo for each connection.
- Leave a clear place for future workflows such as "read information from CAD, then run an action in Revit."

## Plain-Language Product Shape

Think of the app as a control panel.

The user opens one desktop program and can see:

- "Is the CAD side connected?"
- "Is the Revit side connected?"
- "What port or address is each one using?"
- "Can I start or stop the connection?"
- "Later, can I run a CAD-to-Revit workflow from here?"

This app should be built as an Electron desktop app. That means it runs like a Windows program, but its screen is made with web UI technology. This keeps the door open for a future browser dashboard.

## First Version Scope

The first version includes:

- MCP server list
- Add server
- Edit server
- Delete server
- Start server
- Stop server
- Refresh status
- CAD/Revit grouping
- Local data storage

The first version does not include:

- Reading real CAD drawing objects
- Creating real Revit model elements
- Full Codex or Claude configuration editing
- Multi-user sharing
- Cloud sync

Those are later phases.

## Main Screen

The desktop app has one main dashboard.

Left side:

- MCP Servers
- Workflows
- Process Monitor
- Settings

Center:

- Server list
- Server name
- Target program: CAD or Revit
- Connection method: stdio, HTTP, or SSE
- Port or URL
- Status

Right side:

- Selected server details
- Launch command
- Working folder
- Notes
- Start and stop buttons

The Workflows menu can be visible but disabled or marked as "future" in the first version. Its purpose is to reserve space for CAD-to-Revit automation.

## Figma Design Step

Before building the final desktop UI, create or use a Figma design file for the main screen.

Figma should be used to make the screen easier to review before code is written. The first Figma design should show:

- Main desktop dashboard
- CAD connection row
- Revit connection row
- Selected server detail panel
- Future workflow area for CAD-to-Revit actions

The Figma design does not need to be perfect in the first pass. Its purpose is to let the user see and adjust the app shape before implementation decisions become expensive.

If the user already has a Figma file, use that file. If not, create a new Figma design file after confirming the Figma workspace or team to use.

## Data Stored For Each Connection

Each registered connection stores:

- id
- name
- target: cad or revit
- connection type: stdio, http, or sse
- url
- port
- launch command
- working folder
- environment variables
- status
- notes
- created date
- updated date

The first storage format is a local JSON file. This is simple and easy to inspect. If the app grows, the storage can later move to SQLite without changing the user-facing app concept.

## CAD-To-Revit Future Workflow

The design must support this future direction:

1. Connect to CAD.
2. Ask CAD for drawing information.
3. Save or pass that information in a structured form.
4. Connect to Revit.
5. Run a Revit action based on the CAD information.

Example future workflow:

- Read CAD layers and block positions.
- Convert them into a clean data package.
- Ask Revit to place elements, create views, or update parameters.

This is not part of the first build, but the first build must not block it.

## App Structure

Use a small project structure:

- `packages/shared`: shared data shapes, such as "MCP server" and "connection status"
- `packages/core`: logic for saving, loading, validating, starting, stopping, and checking servers
- `packages/desktop`: Electron desktop app
- `data/registry.json`: local saved connection list for development

This keeps the important logic separate from the desktop window. Later, a web dashboard can reuse the same core logic.

## Error Handling

The app should explain problems in simple language.

Examples:

- "This port is already in use."
- "The launch command path does not exist."
- "The server did not respond."
- "CAD connection is saved, but not running."
- "Revit connection is saved, but not running."

The app should avoid hiding errors in technical logs only.

## Testing

The first version should test:

- Adding a CAD connection
- Adding a Revit connection
- Editing a saved connection
- Deleting a saved connection
- Loading saved data after reopening the app
- Detecting a port as available or unavailable
- Handling invalid launch paths

Manual verification should also confirm that the app opens as a Windows desktop window and shows the dashboard clearly.

## Decisions Made

- Start with the connection manager, not full automation.
- Use Electron for the Windows desktop app.
- Use Figma during UI design before final desktop implementation.
- Keep future web dashboard support in mind.
- Store data locally first.
- Design for CAD and Revit to be connected at the same time.

## Implementation Defaults

Use these defaults unless the user changes them:

- Build the UI with React and TypeScript because the same screen can later move to a web dashboard.
- The first working build should save real connection data and check ports, but starting and stopping external CAD/Revit bridge processes can be added after the basic registry works.
- During development, use `data/registry.json` inside the project. For real user use, store the registry under the user's app data folder.
- For Figma, either use a Figma design file provided by the user or create a new one after the Figma workspace is confirmed.
