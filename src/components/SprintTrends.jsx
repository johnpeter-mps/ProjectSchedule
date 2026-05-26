import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar } from 'recharts';
import './SprintTrends.css';

// ─── DATE → SPRINT NAME MAP ───────────────────────────────────────────────────
// Add any date keys here whose DynamoDB records were saved with date-based names.
// Format: "YYYY-MM-DD": "Actual Sprint Name"
const DATE_TO_SPRINT_NAME = {
  "2026-03-19": "AIML Sprint 39",
  "2026-03-20": "AIML Sprint 39",
  "2026-03-23": "AIML Sprint 39",
  "2026-03-24": "AIML Sprint 40",
  "2026-03-25": "AIML Sprint 40",
  "2026-03-26": "AIML Sprint 40",
  "2026-03-27": "AIML Sprint 40",
  "2026-03-30": "AIML Sprint 40",
  "2026-03-31": "AIML Sprint 40",
  "2026-04-01": "AIML Sprint 40",
  "2026-04-02": "AIML Sprint 40",
  "2026-04-03": "AIML Sprint 40",
  // Add more as needed for any dates that saved with bad names:
  // "2026-05-11": "AIML Sprint XX",
  // "2026-05-13": "AIML Sprint XX",
};

// ─── INCOMPLETE SAVE THRESHOLDS ───────────────────────────────────────────────
// Records with fewer tickets/points than these are partial saves (e.g. 20 May dip)
const MIN_TICKETS = 5;
const MIN_STORY_POINTS = 1;

function SprintTrends({ currentSprintData, sprintHistory: sprintHistoryProp }) {
  const [sprintHistory, setSprintHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSprint, setSelectedSprint] = useState(null);

  useEffect(() => {
    if (sprintHistoryProp && sprintHistoryProp.length > 0) {
      console.log('Raw sprint history received:', sprintHistoryProp.length, 'records');

      const sorted = [...sprintHistoryProp].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      // ── FIX: Filter out incomplete saves (the 20 May dip) ──────────────────
      const filtered = sorted.filter(s => {
        const tickets = s.totalTickets || s.completedTickets || 0;
        const points  = s.totalStoryPoints || s.totalPoints || 0;
        return tickets >= MIN_TICKETS || points >= MIN_STORY_POINTS;
      });

      console.log(`After filtering incomplete saves: ${filtered.length} records remain`);
      setSprintHistory(filtered);
      setLoading(false);
    } else {
      console.log('No sprint history available');
      setSprintHistory([]);
      setLoading(false);
    }
  }, [sprintHistoryProp]);

  // ─── CENTRAL NAME RESOLVER ─────────────────────────────────────────────────
  // Called everywhere a sprint label is needed — both in charts and detail view.
  const resolveSprintName = (sprint) => {
    // 1. Try the date-map first (fixes old bad DynamoDB records)
    const dateKey = sprint.timestamp?.split('T')[0] || sprint.date;
    if (dateKey && DATE_TO_SPRINT_NAME[dateKey]) {
      return DATE_TO_SPRINT_NAME[dateKey];
    }

    // 2. If sprintName looks like a real Jira sprint name (not a date fallback), use it
    const name = sprint.sprintName || '';
    if (name && !name.match(/^Sprint \d{4}-\d{2}-\d{2}$/)) {
      return name;
    }

    // 3. Last resort — we have no good name; use sprintId if it looks real
    if (sprint.sprintId && !sprint.sprintId.startsWith('sprint-')) {
      return sprint.sprintId;
    }

    // 4. Absolute fallback — still better than a raw ISO date
    return `Sprint (${dateKey || 'unknown'})`;
  };

  // ─── FORMAT DATA FOR MAIN TREND CHARTS ────────────────────────────────────
  // Deduplicates by resolved sprint name, keeping the latest record per sprint.
  const formatChartData = () => {
    // Step 1: resolve names and deduplicate — keep latest record per sprint name
    const byName = {};
    sprintHistory.forEach(sprint => {
      const name = resolveSprintName(sprint); // ← FIX: applied here, not just in detail view
      if (!byName[name] || new Date(sprint.timestamp) > new Date(byName[name].timestamp)) {
        byName[name] = { ...sprint, resolvedName: name };
      }
    });

    // Step 2: sort by timestamp of the kept record
    const deduped = Object.values(byName).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Step 3: filter clearly bad velocity data (keeps real 100+ ticket sprints)
    const clean = deduped.filter(s => {
      const velocity = s.velocity || s.completedPoints || 0;
      return velocity <= 500;
    });

    return clean.map(sprint => {
      const totalSP     = sprint.totalStoryPoints || sprint.totalPoints || 0;
      const completedSP = sprint.completedStoryPoints || sprint.completedPoints || sprint.velocity || 0;
      const completionRate = totalSP > 0
        ? parseFloat(((completedSP / totalSP) * 100).toFixed(1))
        : 0;

      const onHoldTickets = (sprint.ticketDetails || []).filter(t => {
        const s = t.status?.toLowerCase() || '';
        return s.includes('hold') || s.includes('blocked');
      }).length;

      return {
        name: sprint.resolvedName,   // ← always a proper sprint name now
        productivity:     sprint.productivity || 0,
        velocity:         sprint.velocity || 0,
        bugs:             sprint.bugCount || 0,
        completedBugs:    sprint.completedBugCount || 0,
        completionRate,              // always a number
        completedTickets: sprint.completedTickets || 0,
        onHoldTickets,
      };
    });
  };

  // ─── SPRINT DETAIL DATA (reuses same dedup logic) ─────────────────────────
  const getDetailSprints = () => {
    const byName = {};
    sprintHistory.forEach(sprint => {
      const name = resolveSprintName(sprint);
      if (!byName[name] || new Date(sprint.timestamp) > new Date(byName[name].timestamp)) {
        byName[name] = { ...sprint, resolvedName: name };
      }
    });

    return Object.values(byName)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // newest first for dropdown
      .map(sprint => {
        const totalSP     = sprint.totalStoryPoints || sprint.totalPoints || 0;
        const completedSP = sprint.completedStoryPoints || sprint.completedPoints || sprint.velocity || 0;
        const completionRate = totalSP > 0
          ? parseFloat(((completedSP / totalSP) * 100).toFixed(1))
          : 0;
        const onHoldTickets = (sprint.ticketDetails || []).filter(t => {
          const s = t.status?.toLowerCase() || '';
          return s.includes('hold') || s.includes('blocked');
        }).length;

        return {
          name:             sprint.resolvedName,
          velocity:         sprint.velocity || 0,
          completedTickets: sprint.completedTickets || 0,
          productivity:     sprint.productivity || 0,
          onHoldTickets,
          completionRate,
        };
      });
  };

  if (loading && sprintHistory.length === 0) {
    return <div className="sprint-trends loading">Loading sprint history...</div>;
  }

  const chartData    = formatChartData();
  const detailSprints = getDetailSprints();

  return (
    <div className="sprint-trends">
      <div className="sprint-trends-header">
        <h2>Sprint Trends (Last 10 Sprints)</h2>
        <div className="header-info">
          <span className="info-badge">Auto-saved daily when tickets are loaded</span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          Error: {error}. Make sure the Lambda function is deployed and DynamoDB is configured.
        </div>
      )}

      {sprintHistory.length === 0 && !loading && (
        <div className="no-data-message">
          No sprint history available yet. Load JIRA tickets to automatically save sprint data and start tracking trends.
        </div>
      )}

      {chartData.length > 0 && (
        <div className="trends-grid">

          {/* ── Velocity & Completion Rate ──────────────────────────────────── */}
          <div className="trend-card full-width">
            <h3>Velocity & Completion Rate Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis yAxisId="left"  orientation="left"  stroke="#0052cc" />
                <YAxis yAxisId="right" orientation="right" stroke="#00875a" domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar  yAxisId="left"  dataKey="velocity"       fill="#0052cc" name="Velocity (Story Points)" />
                <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="#00875a"
                  strokeWidth={3} name="Completion Rate (%)" dot={{ fill: '#00875a', r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="chart-inference">
              <strong>What to Infer?</strong> Track team velocity (completed story points) and completion rate over time.
              Consistent or increasing velocity indicates stable team performance. Completion rate shows planning accuracy.
            </div>
          </div>

          {/* ── Bug Trend ───────────────────────────────────────────────────── */}
          <div className="trend-card full-width">
            <h3>Bug Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar  dataKey="bugs"          fill="#bf2600" name="Total Bugs" />
                <Bar  dataKey="completedBugs" fill="#00875a" name="Completed Bugs" />
                <Line type="monotone" dataKey="bugs" stroke="#bf2600"
                  strokeWidth={2} name="Bug Trend" dot={{ fill: '#bf2600', r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="chart-inference">
              <strong>What to Infer?</strong> Monitor bug creation and resolution trends.
              Increasing bug count may indicate quality issues. Green bars show bug resolution effectiveness.
            </div>
          </div>

          {/* ── Team Productivity ───────────────────────────────────────────── */}
          <div className="trend-card full-width">
            <h3>Team Productivity Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="productivity" stroke="#6554c0"
                  strokeWidth={3} name="Productivity (%)" dot={{ fill: '#6554c0', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="chart-inference">
              <strong>What to Infer?</strong> Overall team productivity percentage over sprints.
              Consistent high productivity indicates effective sprint planning and execution.
            </div>
          </div>

          {/* ── Tickets Completed ───────────────────────────────────────────── */}
          <div className="trend-card full-width">
            <h3>Tickets Completed Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar  dataKey="completedTickets" fill="#00875a" name="Completed Tickets" />
                <Line type="monotone" dataKey="completedTickets" stroke="#00875a"
                  strokeWidth={2} name="Completion Trend" dot={{ fill: '#00875a', r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="chart-inference">
              <strong>What to Infer?</strong> Track the number of tickets completed per sprint.
              Consistent or increasing completion indicates steady team throughput and delivery capacity.
            </div>
          </div>

          {/* ── Tickets on Hold ─────────────────────────────────────────────── */}
          <div className="trend-card full-width">
            <h3>Tickets on Hold Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar  dataKey="onHoldTickets" fill="#ff991f" name="Tickets on Hold" />
                <Line type="monotone" dataKey="onHoldTickets" stroke="#ff991f"
                  strokeWidth={2} name="On Hold Trend" dot={{ fill: '#ff991f', r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="chart-inference">
              <strong>What to Infer?</strong> Monitor tickets that are blocked or on hold.
              Increasing trend may indicate dependencies, blockers, or process bottlenecks that need attention.
            </div>
          </div>
        </div>
      )}

      {/* ── Sprint Detail View ───────────────────────────────────────────────── */}
      {detailSprints.length > 0 && (
        <div className="sprint-detail-section">
          <h3>Sprint Detail View</h3>
          <div style={{ marginBottom: '1rem' }}>
            <select
              value={selectedSprint || ''}
              onChange={(e) => setSelectedSprint(e.target.value)}
              style={{ padding: '8px 16px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc' }}
            >
              <option value="">Select a Sprint</option>
              {detailSprints.map((sprint, index) => (
                <option key={index} value={sprint.name}>{sprint.name}</option>
              ))}
            </select>
          </div>

          {selectedSprint && (() => {
            const sprint = detailSprints.find(s => s.name === selectedSprint);
            if (!sprint) return null;
            const chartData = [{ name: sprint.name, ...sprint }];
            return (
              <div>
                <div className="chart-container">
                  <h4>Velocity & Completion Rate</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar  yAxisId="left"  dataKey="velocity"       name="Velocity (Story Points)" fill="#1a56db" />
                      <Line yAxisId="right" type="monotone" dataKey="completionRate"
                        name="Completion Rate (%)" stroke="#16a34a" strokeWidth={2} dot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-container">
                  <h4>Team Productivity</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="productivity" name="Productivity (%)"
                        stroke="#7c3aed" strokeWidth={2} dot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-container">
                  <h4>Tickets Completed</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completedTickets" name="Completed Tickets" fill="#16a34a" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-container">
                  <h4>Tickets on Hold</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="onHoldTickets" name="Tickets on Hold" fill="#f59e0b" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default SprintTrends;