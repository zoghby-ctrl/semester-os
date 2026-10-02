import { useApp } from "../lib/context";

export function AttendanceInstructions() {
  const { settings } = useApp();
  return <div className="workflow-copy">
    <p>Open a class in Today or Schedule, enter your actual arrival time, choose a status, then select Save attendance. Reopen the same class and date to correct it or clear the saved record.</p>
    <p>From arrival time uses your {settings.graceMinutes}-minute grace period. On time, attended, and late count as present; missed counts as absent; excused is excluded from the percentage. Overrides let you correct the status yourself.</p>
    <p>{settings.autoMissed ? "Automatic missed classification is on: after a class ends, an unrecorded session within your tracking dates counts as missed. You can correct it later." : "Automatic missed classification is off: an unrecorded class stays unrecorded and does not count in your percentage."} Change grace, tracking dates, holidays, or this option in Settings → Preferences.</p>
    <p>Check-ins are your personal record on this device. The app does not detect your presence or submit attendance to your university.</p>
  </div>;
}

export function WorkflowGuide({ compact = false }: { compact?: boolean }) {
  return <details className={compact ? "workflow-guide panel" : "workflow-guide"} open={!compact}>
    <summary>How to use Semester OS</summary>
    <div className="workflow-copy">
      <h3>Start with your timetable</h3>
      <p>Setup → Upload your timetable → review each course and session → Generate my semester. A material plan is optional. Use the original PDF or choose only your semester's plan pages, and correct uncertain names before confirming. Edit scheduled times later in Settings → Timetable.</p>
      <h3>Record or correct attendance</h3>
      <AttendanceInstructions />
      <h3>Keep course work together</h3>
      <p>Courses → choose a course to add notes and topics. Mark topics as you learn them; topic progress is separate from attendance. Planner holds assignments, exams, and tasks; add a due date and mark work done when you finish.</p>
      <h3>Study and see progress</h3>
      <p>Start a study timer in Today and save the session when you finish. Progress shows saved study time, topic progress, and attendance. Passing time on the timetable does not record an arrival.</p>
      <h3>Keep a copy</h3>
      <p>Settings → Data & backup → Export backup. Data stays in this browser; another device or browser has its own workspace. Import your backup there to bring your records with you. Prepare offline import tools in Settings to read new documents offline too.</p>
    </div>
  </details>;
}
