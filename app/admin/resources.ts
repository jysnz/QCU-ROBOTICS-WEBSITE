/* Declarative description of the website tables the admin can edit (from the QCUR-Apex docs/03-database-schema.md).
   CrudPanel renders a list + create/edit/delete UI for each entry. */
export type FieldType = "text" | "textarea" | "number" | "boolean" | "date" | "select" | "relation" | "image" | "video" | "daterange";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Shown as a column in the list (the title field is always shown). */
  list?: boolean;
  options?: string[];
  /** For a select: add an "Other…" choice that reveals a text box for a value that isn't in the list. */
  allowOther?: boolean;
  otherLabel?: string;
  /** For type "relation": the table the id points to and which column to show. */
  relation?: { table: string; labelKey: string; orderBy?: string; /** team_members only: hide graduated players from the choices */ notGraduated?: boolean;
    /** List the options under a heading taken from another table (e.g. competitions grouped by season). */
    groupBy?: { key: string; table: string; labelKey: string } };
  /** For type "image": where uploads go. */
  bucket?: string;
  folder?: string;
  hint?: string;
  /** Worked out by the database (a generated column): shown in lists and filters but never in the form or saved. */
  readOnly?: boolean;
  /** Faint example text inside the empty box. */
  placeholder?: string;
  /** Always take the full width of the form (otherwise two short fields share a row). */
  wide?: boolean;
  /** Letters are saved in capitals (codes). */
  upper?: boolean;
  maxLength?: number;
  /** Only offered when the table already has this column. */
  optional?: boolean;
  /** SQL that adds the missing column; shown (with a copy button) when an optional image field's column doesn't exist yet. */
  sql?: string;
  /** Narrow a relation's choices using another field of the same form: only options linked to the chosen value of `field` through a link table. */
  limitBy?: { field: string; table: string; matchKey: string; valueKey: string; emptyHint: string; chooseHint: string };
};

export type Resource = {
  id: string;
  group: "People" | "Competitions" | "Site";
  label: string;
  singular: string;
  description: string;
  table: string;
  /** Primary key column when it isn't "id". */
  pk?: string;
  orderBy: string;
  ascending?: boolean;
  /** Column used as the row's name in lists and delete confirmations. */
  titleKey: string;
  /** Column holding the row's picture, if any. */
  imageKey?: string;
  fields: Field[];
  /* ── how the admin lays the list out (all optional) ── */
  /** "rows" (default), "cards" (picture banner) or "scores" (match results). */
  layout?: "rows" | "cards" | "scores" | "chips" | "links" | "text";
  /** Hide every "Add ..." button: the rows are fixed (they already exist) and can only be edited. */
  noAdd?: boolean;
  /** Icon name, see ICONS in CrudPanel. */
  icon?: string;
  /** Field to group the list by (relation, select, text, or a date to group by year). */
  groupKey?: string;
  /** With a relation groupKey that has a groupBy (competition -> season): list season headings first, competitions inside them. */
  nestGroups?: boolean;
  /** Heading for rows whose group field is empty (default "Other"). */
  groupEmpty?: string;
  /** Relation field turned into a row of quick-filter chips (with counts and the win-loss record when rows have a result). */
  chipKey?: string;
  /** Count how many rows of another table point at each row (e.g. players using a role). */
  usage?: { table: string; key: string; noun: string };
  /** Field holding a video link; rows that have one become tappable and open a player. */
  videoKey?: string;
  /** Fields to offer as dropdown filters above the list. */
  filterKeys?: string[];
  /** Select field shown as a coloured pill (status, result...). */
  badgeKey?: string;
  /** Boolean field flipped by an inline switch on each row. */
  toggleKey?: string;
  /** Short value shown in a square badge at the start of a row (e.g. a team number). */
  leadKey?: string;
};

const PICTURES = "member-pictures";

export const RESOURCES: Resource[] = [
  {
    id: "team-players", group: "People", label: "Team players", singular: "team player",
    description: "Players shown on the Meet the players section. Link them to teams and roles under Assignments.",
    table: "team_members", orderBy: "name", titleKey: "name", imageKey: "profile_image_url",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "profile_image_url", label: "Photo", type: "image", bucket: PICTURES, folder: "team_members" },
      { key: "is_active", label: "Active", type: "boolean", list: true },
      { key: "is_graduated", label: "Graduated", type: "boolean", list: true },
    ],
  },
  {
    id: "assignments", group: "People", label: "Team assignments", singular: "assignment",
    description: "Which team a player belongs to in each season.",
    table: "member_team_seasons", orderBy: "id", ascending: false, titleKey: "member_id",
    fields: [
      { key: "member_id", label: "Player", type: "relation", required: true, list: true, relation: { table: "team_members", labelKey: "name", orderBy: "name" } },
      { key: "team_id", label: "Team", type: "relation", required: true, list: true, relation: { table: "teams", labelKey: "team_name", orderBy: "team_number" } },
      { key: "season_id", label: "Season", type: "relation", required: true, list: true, relation: { table: "seasons", labelKey: "season_name", orderBy: "id" } },
    ],
  },
  {
    id: "player-roles", group: "People", label: "Player roles", singular: "player role",
    description: "A player's role (captain, driver, builder...) in a season.",
    table: "member_roles", orderBy: "id", ascending: false, titleKey: "member_id",
    fields: [
      { key: "member_id", label: "Player", type: "relation", required: true, list: true, relation: { table: "team_members", labelKey: "name", orderBy: "name", notGraduated: true } },
      { key: "role_id", label: "Role", type: "relation", required: true, list: true, relation: { table: "roles", labelKey: "role_name", orderBy: "role_name" } },
      { key: "season_id", label: "Season", type: "relation", required: true, list: true, relation: { table: "seasons", labelKey: "season_name", orderBy: "id" } },
    ],
  },
  {
    id: "media-team", group: "People", label: "Media team", singular: "media team member",
    description: "People shown in the Media team section.",
    table: "media_team", orderBy: "name", titleKey: "name", imageKey: "image_url",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "position", label: "Position", type: "text", list: true },
      { key: "image_url", label: "Photo", type: "image", bucket: PICTURES, folder: "media_team" },
      { key: "is_active", label: "Active", type: "boolean", list: true },
    ],
  },
  {
    id: "members", group: "People", label: "Members", singular: "member",
    description: "Approved members shown on the site. New sign-ups from /member-reg are reviewed under Registrations.",
    table: "members", orderBy: "name", titleKey: "name", imageKey: "image_url",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "image_url", label: "Photo", type: "image", bucket: PICTURES, folder: "members" },
      { key: "is_active", label: "Active", type: "boolean", list: true },
    ],
  },
  {
    id: "coaches", group: "People", label: "Coaches", singular: "coach",
    description: "Coaches shown in the Meet our coaches section.",
    table: "Coaches", orderBy: "name", titleKey: "name", imageKey: "image_url",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "image_url", label: "Photo", type: "image", bucket: PICTURES, folder: "coaches" },
      { key: "is_active", label: "Active", type: "boolean", list: true },
    ],
  },
  {
    id: "seasons", group: "Competitions", label: "Seasons", singular: "season",
    description: "VEX seasons (Over Under, High Stakes...). Newer seasons should have a higher id so they sort first.",
    table: "seasons", orderBy: "id", ascending: false, titleKey: "season_name",
    icon: "season", toggleKey: "is_active",
    fields: [
      { key: "season_name", label: "Season name", type: "text", required: true },
      { key: "is_active", label: "Active season", type: "boolean", list: true, optional: true, hint: "Team assignments can only be added to active seasons." },
    ],
  },
  {
    id: "teams", group: "Competitions", label: "Teams", singular: "team",
    description: "Robotics teams per season.",
    table: "teams", orderBy: "id", ascending: false, titleKey: "team_name",
    icon: "team", groupKey: "season_id", filterKeys: ["season_id"], toggleKey: "is_active", leadKey: "team_number",
    fields: [
      { key: "team_name", label: "Team name", type: "text", required: true, placeholder: "e.g. Alpha" },
      { key: "team_code", label: "Team code", type: "text", list: true, placeholder: "TNTN", hint: "e.g. TNTN", upper: true, maxLength: 8 },
      { key: "team_number", label: "Team number", type: "number", required: true, list: true, placeholder: "e.g. 1" },
      { key: "season_id", label: "Season", type: "relation", list: true, wide: true, relation: { table: "seasons", labelKey: "season_name", orderBy: "id" } },
      { key: "is_active", label: "Active", type: "boolean", list: true },
    ],
  },
  {
    id: "competitions", group: "Competitions", label: "Competitions", singular: "competition",
    description: "The competitions the team entered, shown in the Competitions section of the site.",
    table: "competitions", orderBy: "id", ascending: false, titleKey: "title", imageKey: "image_url",
    icon: "competition", layout: "cards", groupKey: "season_id", filterKeys: ["season_id", "status"], badgeKey: "status",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "season_id", label: "Season", type: "relation", list: true, relation: { table: "seasons", labelKey: "season_name", orderBy: "id" } },
      { key: "status", label: "Status", type: "select", list: true, readOnly: true, options: ["Upcoming", "Active", "Completed"] },
      { key: "location", label: "Location", type: "text" },
      { key: "date", label: "Date", type: "daterange", list: true, wide: true, hint: "One day or a range. The status follows it: Upcoming before this date, Active during it, Completed after it." },
      { key: "image_url", label: "Image", type: "image", bucket: "images", folder: "Competition_pictures" },
    ],
  },
  {
    id: "matches", group: "Competitions", label: "Matches", singular: "match",
    description: "Match results and videos shown on the Matches page.",
    table: "matches", orderBy: "id", ascending: false, titleKey: "name",
    icon: "match", layout: "scores", groupKey: "competition_id", groupEmpty: "Not linked to a competition", filterKeys: ["competition_id", "result"], chipKey: "team_id", videoKey: "video_url", badgeKey: "result",
    fields: [
      { key: "name", label: "Match name", type: "text", required: true },
      { key: "competition_id", label: "Competition", type: "relation", required: true, list: true, hint: "Only competitions listed on the website. Add the competition under Competitions first.", relation: { table: "competitions", labelKey: "title", orderBy: "id", groupBy: { key: "season_id", table: "seasons", labelKey: "season_name" } } },
      { key: "team_id", label: "Team", type: "relation", list: true, hint: "Only teams that took part in the chosen competition.", relation: { table: "teams", labelKey: "team_name", orderBy: "team_number" }, limitBy: { field: "competition_id", table: "team_competitions", matchKey: "competition_id", valueKey: "team_id", chooseHint: "Choose a competition first", emptyHint: "No teams are linked to this competition" } },
      { key: "our_score", label: "Our score", type: "number", list: true },
      { key: "opponent_score", label: "Opponent score", type: "number", list: true },
      { key: "opponent_name", label: "Opponent", type: "text" },
      { key: "result", label: "Result", type: "select", list: true, readOnly: true, options: ["Win", "Loss", "Draw"] }, // the database works it out from the two scores
      { key: "video_url", label: "Video", type: "video" }, // a video file, converted to streaming pieces in the background
      { key: "sequence", label: "Display order", type: "number" },
    ],
  },
  {
    id: "achievements", group: "Competitions", label: "Achievements", singular: "achievement",
    description: "Awards the team won, shown on the Achievements page of the site. Pick the competition, then name the award.",
    table: "Achievements", pk: "achievement_id", orderBy: "achievement_id", ascending: false, titleKey: "achievement_name", imageKey: "image_url",
    icon: "achievement", groupKey: "competition_id", nestGroups: true, groupEmpty: "Not linked to a competition", filterKeys: ["competition_id"],
    fields: [
      { key: "competition_id", label: "Competition", type: "relation", required: true, hint: "Only competitions listed on the website.", relation: { table: "competitions", labelKey: "title", orderBy: "id", groupBy: { key: "season_id", table: "seasons", labelKey: "season_name" } } },
      { key: "achievement_name", label: "Achievement title", type: "text", required: true, hint: "e.g. Excellence Award, Tournament Champions" },
      { key: "team_id", label: "Team", type: "relation", list: true, hint: "Only teams that took part in the chosen competition.", relation: { table: "teams", labelKey: "team_name", orderBy: "team_number" }, limitBy: { field: "competition_id", table: "team_competitions", matchKey: "competition_id", valueKey: "team_id", chooseHint: "Choose a competition first", emptyHint: "No teams are linked to this competition" } },
      { key: "national_award", label: "National award", type: "boolean", list: true },
      { key: "international_award", label: "International award", type: "boolean", list: true },
      { key: "image_url", label: "Photo of the award", type: "image", optional: true, bucket: "images", folder: "Achievement_pictures", hint: "Optional. Saved to the images storage bucket.", sql: 'alter table website."Achievements" add column if not exists image_url text;' },
    ],
  },
  {
    id: "roles", group: "Site", label: "Role names", singular: "role",
    description: "The roles a player can hold in a season, such as captain, driver or builder. They are picked when you add a team player.",
    table: "roles", orderBy: "role_name", titleKey: "role_name",
    icon: "role", layout: "chips", usage: { table: "member_roles", key: "role_id", noun: "player" },
    fields: [{ key: "role_name", label: "Role name", type: "text", required: true }],
  },
  {
    id: "sponsor-companies", group: "Site", label: "Sponsor companies", singular: "sponsor company",
    description: "Companies listed in the Sponsors section.",
    table: "sponsor_company", orderBy: "id", titleKey: "company_name", imageKey: "image_url",
    fields: [
      { key: "company_name", label: "Company name", type: "text", required: true },
      { key: "image_url", label: "Logo", type: "image", bucket: "images", folder: "Sponsor_pictures" },
    ],
  },
  {
    id: "sponsors", group: "Site", label: "Sponsors", singular: "sponsor",
    description: "People representing each sponsor company.",
    table: "sponsors", orderBy: "id", titleKey: "name", imageKey: "image_url",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "company_id", label: "Company", type: "relation", list: true, relation: { table: "sponsor_company", labelKey: "company_name", orderBy: "company_name" } },
      { key: "image_url", label: "Photo", type: "image", bucket: "images", folder: "Sponsor_pictures" },
    ],
  },
  {
    id: "socials", group: "Site", label: "Social links", singular: "social link",
    description: "The social media links shown in the website footer.",
    table: "socials", orderBy: "id", titleKey: "platform",
    icon: "social", layout: "links",
    fields: [
      { key: "platform", label: "Platform", type: "select", required: true, allowOther: true, otherLabel: "Which platform?", options: ["Facebook", "Instagram", "YouTube", "TikTok", "X (Twitter)", "LinkedIn", "GitHub", "Discord"], hint: "Pick the platform, or choose Other to type its name." },
      { key: "url", label: "URL", type: "text", list: true },
    ],
  },
  {
    id: "descriptions", group: "Site", label: "Page text", singular: "text block",
    description: "The wording that appears in sections of the website, such as About us. Edit it here and the site updates.",
    table: "descriptions", orderBy: "id", titleKey: "section",
    icon: "text", layout: "text", noAdd: true,
    fields: [
      { key: "section", label: "Section", type: "text", required: true },
      { key: "description", label: "Text", type: "textarea" },
    ],
  },
];
