import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Cell
} from 'recharts';

function WeeklyProgress({ tickets }) {
  // CRITICAL: Check for empty/null tickets BEFORE using them
  if (!tickets || tickets.length === 0) {
    return null;
  }

  console.log('WeeklyProgress received tickets:', tickets?.length, tickets?.[0]?.key);
  const [chartType, setChartType] = useState('weekly'); // 'weekly' or 'developer'

  // Get Monday of the week for a given date
  const getMondayOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Format date as "2 Jun"
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Generate last 4 weeks (Mon-Fri)
  const getLast4Weeks = () => {
    const weeks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentMonday = getMondayOfWeek(today);

    for (let i = 3; i >= 0; i--) {
      const monday = new Date(currentMonday);
      monday.setDate(monday.getDate() - i * 7);

      const friday = new Date(monday);
      friday.setDate(friday.getDate() + 4);

      weeks.push({
        monday,
        friday,
        label: `${formatDate(monday)}-${formatDate(friday)}`
      });
    }
    return weeks;
  };

  // Check if a date falls within a week (Mon-Fri)
  const isInWeek = (dateString, monday, friday) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date >= monday && date <= friday;
  };

  const weeks = getLast4Weeks();

  // Get all unique developers (excluding Unassigned)
  const developers = [...new Set(
    tickets
      .filter(t => t.fields.assignee?.displayName)
      .map(t => t.fields.assignee.displayName)
  )].sort();

  // Calculate stats per developer per week
  const getWeekStats = (developer, week) => {
    const weekTickets = tickets.filter(t => {
      const assignee = t.fields.assignee?.displayName;
      return assignee === developer && isInWeek(t.fields.duedate, week.monday, week.friday);
    });

    const completed = weekTickets.filter(t => {
      const status = t.fields.status?.name?.toLowerCase() || '';
      return status.includes('done') || status.includes('complete');
    }).length;

    const total = weekTickets.length;
    const pending = total - completed;

    return { completed, pending, total, tickets: weekTickets };
  };

  // Calculate row totals
  const getDevTotals = (developer) => {
    const devTickets = tickets.filter(t => t.fields.assignee?.displayName === developer);
    const completed = devTickets.filter(t => {
      const status = t.fields.status?.name?.toLowerCase() || '';
      return status.includes('done') || status.includes('complete');
    }).length;
    return { completed, pending: devTickets.length - completed, total: devTickets.length };
  };

  // Calculate column totals
  const getWeekTotals = (week) => {
    const weekTickets = tickets.filter(t => isInWeek(t.fields.duedate, week.monday, week.friday));
    const completed = weekTickets.filter(t => {
      const status = t.fields.status?.name?.toLowerCase() || '';
      return status.includes('done') || status.includes('complete');
    }).length;
    return { completed, pending: weekTickets.length - completed, total: weekTickets.length };
  };

  // Prepare chart data for weekly overview
  const getWeeklyChartData = () => {
    return weeks.map((week, idx) => {
      const totals = getWeekTotals(week);
      return {
        week: `Week ${idx + 1}`,
        label: week.label,
        completed: totals.completed,
        pending: totals.pending,
        total: totals.total
      };
    });
  };

  // Prepare chart data for developer breakdown
  const getDeveloperChartData = () => {
    const data = [];
    developers.forEach(dev => {
      const devData = { name: dev };
      weeks.forEach((week, idx) => {
        const stats = getWeekStats(dev, week);
        devData[`week${idx}Completed`] = stats.completed;
        devData[`week${idx}Pending`] = stats.pending;
        devData[`week${idx}Total`] = stats.total;
      });
      data.push(devData);
    });
    return data;
  };

  const weeklyData = getWeeklyChartData();
  const developerData = getDeveloperChartData();

  // Color scheme
  const colors = {
    completed: '#00875a',
    pending: '#ff991f',
    total: '#0052cc'
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: '1.5rem',
      marginBottom: '2rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#172b4d', margin: 0 }}>
          Weekly Progress Report
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setChartType('weekly')}
            style={{
              padding: '6px 12px',
              background: chartType === 'weekly' ? '#0052cc' : '#e8eaf6',
              color: chartType === 'weekly' ? 'white' : '#172b4d',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: chartType === 'weekly' ? '600' : '500',
              fontSize: '12px'
            }}
          >
            Weekly Overview
          </button>
          <button
            onClick={() => setChartType('developer')}
            style={{
              padding: '6px 12px',
              background: chartType === 'developer' ? '#0052cc' : '#e8eaf6',
              color: chartType === 'developer' ? 'white' : '#172b4d',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: chartType === 'developer' ? '600' : '500',
              fontSize: '12px'
            }}
          >
            By Developer
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '1rem', fontSize: '12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', background: colors.completed, borderRadius: '2px', display: 'inline-block' }}></span>
          Completed
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', background: colors.pending, borderRadius: '2px', display: 'inline-block' }}></span>
          Pending
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', background: colors.total, borderRadius: '2px', display: 'inline-block' }}></span>
          Total
        </span>
      </div>

      {chartType === 'weekly' ? (
        <div>
          {/* Weekly Overview - Stacked Bar Chart */}
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart
              data={weeklyData}
              margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12, fill: '#5e6c84' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#5e6c84' }}
                label={{ value: 'Number of Tickets', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '8px'
                }}
                formatter={(value) => value}
                labelFormatter={(label) => `${label}`}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="completed" stackId="a" fill={colors.completed} name="Completed" radius={[8, 8, 0, 0]} />
              <Bar dataKey="pending" stackId="a" fill={colors.pending} name="Pending" radius={[8, 8, 0, 0]} />
              <Line
                type="monotone"
                dataKey="total"
                stroke={colors.total}
                strokeWidth={2}
                name="Total"
                dot={{ fill: colors.total, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Weekly Stats Summary */}
          <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
            {weeklyData.map((week, idx) => (
              <div key={idx} style={{
                padding: '12px',
                background: '#f9f9f9',
                borderRadius: '6px',
                border: '1px solid #eee'
              }}>
                <div style={{ fontSize: '11px', color: '#5e6c84', marginBottom: '8px', fontWeight: '500' }}>
                  {week.week}
                </div>
                <div style={{ fontSize: '10px', color: '#5e6c84', marginBottom: '6px' }}>
                  {week.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: colors.completed, fontWeight: '600', fontSize: '12px' }}>
                    ✓ {week.completed}
                  </span>
                  <span style={{ color: colors.pending, fontWeight: '600', fontSize: '12px' }}>
                    ⏳ {week.pending}
                  </span>
                  <span style={{ color: colors.total, fontWeight: '600', fontSize: '12px' }}>
                    📋 {week.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {/* Developer Breakdown - Grouped Bar Chart */}
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={developerData}
              margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#5e6c84' }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#5e6c84' }}
                label={{ value: 'Completed Tickets', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '8px'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {weeks.map((week, idx) => (
                <Bar
                  key={`week${idx}`}
                  dataKey={`week${idx}Completed`}
                  fill={`hsla(${idx * 90}, 70%, 50%, 0.8)`}
                  name={`Week ${idx + 1} - Completed`}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {/* Developer Summary */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '14px', color: '#172b4d', marginBottom: '1rem' }}>Developer Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {developers.map((dev, idx) => {
                const devTotals = getDevTotals(dev);
                return (
                  <div key={idx} style={{
                    padding: '12px',
                    background: '#f9f9f9',
                    borderRadius: '6px',
                    border: '1px solid #eee'
                  }}>
                    <div style={{ fontSize: '13px', color: '#172b4d', fontWeight: '600', marginBottom: '8px' }}>
                      {dev}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: colors.completed, fontWeight: '600', fontSize: '12px' }}>
                        ✓ {devTotals.completed} Completed
                      </span>
                      <span style={{ color: colors.pending, fontWeight: '600', fontSize: '12px' }}>
                        ⏳ {devTotals.pending} Pending
                      </span>
                      <span style={{ color: colors.total, fontWeight: '600', fontSize: '12px' }}>
                        📋 {devTotals.total} Total
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: '12px', color: '#5e6c84', marginTop: '1rem' }}>
        * Weeks based on ticket due dates (Mon–Fri). Tickets without due dates are excluded from weekly view but included in totals.
      </div>
    </div>
  );
}

export default WeeklyProgress;