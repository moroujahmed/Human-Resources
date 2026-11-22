import { StaffHubRoleSchema } from "@staffhub/shared";

export default function HomePage() {
  return (
    <main>
      <p>Phase 1 foundation</p>
      <h1>StaffHub</h1>
      <p>
        The web and API workspaces are initialized. Product workflows are not
        implemented yet.
      </p>
      <h2>Defined staff roles</h2>
      <ul>
        {StaffHubRoleSchema.options.map((role) => (
          <li key={role}>{role}</li>
        ))}
      </ul>
    </main>
  );
}
