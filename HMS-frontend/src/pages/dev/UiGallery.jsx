/* eslint-disable no-console */
import { useState } from "react";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    FileSearch,
    Info,
    Plus,
    RefreshCcw,
    Trash2,
} from "lucide-react";
import {
    Alert,
    Badge,
    Button,
    Card,
    Drawer,
    EmptyState,
    FormGroup,
    Input,
    Modal,
    PageHeader,
    SearchBar,
    Select,
    Table,
    Tabs,
    Textarea,
} from "@/components/ui";

/**
 * Dev-only visual gallery for the HMS design system.
 *
 * Mount at /dev/ui-gallery. Every primitive is rendered in its key
 * variants and states so a regression in hms-system.css or in the React
 * shells surfaces immediately. Interactive demos cover the components
 * whose behaviour can't be verified statically (Modal/Drawer/Tabs/
 * SearchBar).
 *
 * No business logic — safe to mount on any branch. Public route so it
 * works without backend auth.
 */
export default function UiGallery() {
    const [tab, setTab] = useState("overview");
    const [pillTab, setPillTab] = useState("opd");
    const [modalSize, setModalSize] = useState(null); // "sm" | "md" | "lg" | "xl"
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [name, setName] = useState("");
    const [notes, setNotes] = useState("");
    const [role, setRole] = useState("doctor");

    const tableData = [
        { id: 1, name: "Anita Sharma", mrn: "MRN-00012", status: "Active", visits: 3 },
        { id: 2, name: "Karan Mehta", mrn: "MRN-00031", status: "Discharged", visits: 1 },
        { id: 3, name: "Priya Iyer", mrn: "MRN-00045", status: "Admitted", visits: 5 },
    ];

    return (
        <div style={{ minHeight: "100vh", background: "var(--hms-gray-50)" }}>
            <PageHeader
                title="HMS UI Gallery"
                subtitle="Phase 2 design-system primitives — visual + interaction reference"
                actions={
                    <>
                        <Button variant="ghost">Docs</Button>
                        <Button variant="primary">
                            <Plus size={14} strokeWidth={2.4} />
                            New record
                        </Button>
                    </>
                }
            />

            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 32 }}>
                {/* -------------------------------------------------- */}
                <Section title="Buttons">
                    <Row>
                        <Button variant="primary">Primary</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="cancel">Cancel</Button>
                        <Button variant="danger">Danger</Button>
                        <Button variant="danger" outline>Danger outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="icon" aria-label="Refresh"><RefreshCcw size={16} /></Button>
                    </Row>
                    <Row>
                        <Button variant="primary" size="sm">Primary sm</Button>
                        <Button variant="secondary" size="sm">Secondary sm</Button>
                        <Button variant="danger" size="sm">Danger sm</Button>
                    </Row>
                    <Row>
                        <Button variant="primary" color="blue">Blue</Button>
                        <Button variant="primary" color="orange">Orange</Button>
                        <Button variant="primary" color="green">Green</Button>
                    </Row>
                    <Row>
                        <Button variant="primary" loading>Saving…</Button>
                        <Button variant="secondary" loading>Loading…</Button>
                        <Button variant="primary" disabled>Disabled</Button>
                    </Row>
                    <Row>
                        <Button variant="primary" full>Full width primary</Button>
                    </Row>
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Cards">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                        <Card>
                            <strong>Plain card</strong>
                            <p style={{ margin: 0, color: "var(--hms-gray-500)", fontSize: 13 }}>
                                Default surface used across the app.
                            </p>
                        </Card>
                        <Card interactive>
                            <strong>Interactive card</strong>
                            <p style={{ margin: 0, color: "var(--hms-gray-500)", fontSize: 13 }}>Hover to lift.</p>
                        </Card>
                        <Card glass>
                            <strong>Glass card</strong>
                            <p style={{ margin: 0, color: "var(--hms-gray-500)", fontSize: 13 }}>Translucent variant.</p>
                        </Card>
                    </div>
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Badges">
                    <Row>
                        <Badge tone="success">Success</Badge>
                        <Badge tone="warning">Warning</Badge>
                        <Badge tone="danger">Danger</Badge>
                        <Badge tone="info">Info</Badge>
                        <Badge tone="neutral">Neutral</Badge>
                    </Row>
                    <Row>
                        <Badge tone="success" soft>Soft success</Badge>
                        <Badge tone="warning" soft>Soft warning</Badge>
                        <Badge tone="danger" soft>Soft danger</Badge>
                    </Row>
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Form fields">
                    <Card>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <FormGroup label="Patient name" hint="As shown on ID">
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Anita Sharma" />
                            </FormGroup>
                            <FormGroup label="Role">
                                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                                    <option value="doctor">Doctor</option>
                                    <option value="staff">Staff</option>
                                    <option value="hospital_admin">Hospital admin</option>
                                </Select>
                            </FormGroup>
                            <FormGroup label="Email" error="Must be a valid hospital email">
                                <Input type="email" defaultValue="badaddress" />
                            </FormGroup>
                            <FormGroup label="Mobile" hint="10 digits, no country code">
                                <Input inputMode="numeric" placeholder="98765 43210" />
                            </FormGroup>
                            <FormGroup label="Notes" className="grid-col-full" >
                                <Textarea
                                    rows={3}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Anything to flag for the next visit…"
                                />
                            </FormGroup>
                        </div>
                    </Card>
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Search bar">
                    <div style={{ maxWidth: 480 }}>
                        <SearchBar
                            value={search}
                            onChange={setSearch}
                            placeholder="Search patients by name or MRN…"
                        />
                    </div>
                    <p style={{ margin: "8px 0 0", color: "var(--hms-gray-500)", fontSize: 12 }}>
                        Current value: <code>{JSON.stringify(search)}</code>
                    </p>
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Tabs — underline (page navigation)">
                    <Tabs
                        type="underline"
                        active={tab}
                        onChange={setTab}
                        tabs={[
                            { id: "overview", label: "Overview", count: 12 },
                            { id: "vitals", label: "Vitals", count: 4 },
                            { id: "prescriptions", label: "Prescriptions" },
                            { id: "lab", label: "Lab results", count: 0 },
                        ]}
                        panels={{
                            overview: <Card>Overview panel content.</Card>,
                            vitals: <Card>Vitals panel content.</Card>,
                            prescriptions: <Card>Prescriptions panel content.</Card>,
                            lab: <Card>Lab results panel content.</Card>,
                        }}
                    />
                </Section>

                <Section title="Tabs — pill (segmented control)">
                    <Tabs
                        type="pill"
                        active={pillTab}
                        onChange={setPillTab}
                        tabs={[
                            { id: "opd", label: "OPD", count: 24 },
                            { id: "ipd", label: "IPD", count: 8 },
                            { id: "ambulance", label: "Ambulance" },
                        ]}
                    />
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Table">
                    <Table
                        columns={[
                            { header: "Patient", accessor: "name", width: "32%" },
                            { header: "MRN", accessor: "mrn", width: "20%" },
                            {
                                header: "Status",
                                render: (r) => (
                                    <Badge
                                        tone={
                                            r.status === "Active"
                                                ? "success"
                                                : r.status === "Discharged"
                                                    ? "neutral"
                                                    : "info"
                                        }
                                    >
                                        {r.status}
                                    </Badge>
                                ),
                            },
                            { header: "Visits", accessor: "visits", align: "right" },
                        ]}
                        data={tableData}
                        onRowClick={(row) => console.log("clicked row", row)}
                    />
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Empty state">
                    <EmptyState
                        icon={<FileSearch size={24} />}
                        title="No bookings yet"
                        description="Once a checkup is booked it will show up here. Try resetting the date filter or adjusting the search above."
                        action={<Button variant="primary"><Plus size={14} />New booking</Button>}
                    />
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Alerts">
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <Alert tone="info" icon={<Info size={16} />} title="Note">
                            New external lab entries are scoped to this appointment only.
                        </Alert>
                        <Alert tone="warning" icon={<AlertTriangle size={16} />} title="Heads up">
                            Backdating the prescription beyond 7 days requires hospital-admin approval.
                        </Alert>
                        <Alert tone="danger" icon={<Trash2 size={16} />} title="Cannot delete">
                            This doctor has 3 upcoming appointments. Reassign them first.
                        </Alert>
                        <Alert tone="success" icon={<CheckCircle2 size={16} />} title="Saved">
                            Vitals captured at 12:42 PM.
                        </Alert>
                    </div>
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Overlays — Modal & Drawer">
                    <Row>
                        <Button variant="secondary" onClick={() => setModalSize("sm")}>Small modal</Button>
                        <Button variant="secondary" onClick={() => setModalSize("md")}>Medium modal</Button>
                        <Button variant="secondary" onClick={() => setModalSize("lg")}>Large modal</Button>
                        <Button variant="secondary" onClick={() => setModalSize("xl")}>XL modal</Button>
                        <Button variant="primary" onClick={() => setDrawerOpen(true)}>Open drawer</Button>
                    </Row>
                </Section>

                {/* -------------------------------------------------- */}
                <Section title="Live tokens (read directly from :root)">
                    <Card>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, fontSize: 12 }}>
                            {["brand-primary", "gray-50", "gray-200", "gray-500", "gray-800", "success", "warning", "danger", "info"].map((k) => (
                                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span
                                        style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 4,
                                            border: "1px solid var(--hms-gray-200)",
                                            background: `var(--hms-${k})`,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <code>--hms-{k}</code>
                                </div>
                            ))}
                        </div>
                    </Card>
                </Section>

                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--hms-gray-400)", fontSize: 12, padding: "16px 0" }}>
                    <Activity size={14} /> Gallery page is dev-only — not linked from the app shell. Mount path is <code>/dev/ui-gallery</code>.
                </div>
            </div>

            <Modal
                isOpen={modalSize !== null}
                onClose={() => setModalSize(null)}
                size={modalSize || "md"}
                title={`Modal — size ${modalSize}`}
                footer={
                    <>
                        <Button variant="cancel" onClick={() => setModalSize(null)}>Cancel</Button>
                        <Button variant="primary" onClick={() => setModalSize(null)}>Confirm</Button>
                    </>
                }
            >
                <p style={{ margin: 0 }}>
                    This modal is portalled to <code>#modal-root</code>. ESC closes, click on the dark backdrop closes,
                    clicks inside the dialog don't bubble out.
                </p>
                <p style={{ marginTop: 12, color: "var(--hms-gray-500)" }}>
                    Use this for forms (e.g. new patient, new prescription), confirmations, and any blocking dialog.
                </p>
            </Modal>

            <Drawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title="Appointment details"
                subtitle="Drawer mounted via portal — backdrop click closes."
                footer={
                    <>
                        <Button variant="cancel" onClick={() => setDrawerOpen(false)}>Close</Button>
                        <Button variant="primary" onClick={() => setDrawerOpen(false)}>Save</Button>
                    </>
                }
            >
                <FormGroup label="Patient name">
                    <Input placeholder="Anita Sharma" />
                </FormGroup>
                <div style={{ height: 12 }} />
                <FormGroup label="Notes">
                    <Textarea rows={5} placeholder="Anything to flag…" />
                </FormGroup>
            </Drawer>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--hms-gray-500)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
                {title}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
        </section>
    );
}

function Row({ children }) {
    return <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>{children}</div>;
}
