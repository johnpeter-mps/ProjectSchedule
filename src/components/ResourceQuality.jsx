import React from 'react';
import './ResourceQuality.css';

function ResourceQuality({ tickets }) {
  const getStoryPointValue = (ticket) => {
    const fields = ticket.fields;
    const fieldsToCheck = [
      'customfield_10058',
      'customfield_10202',
      'customfield_10005',
      'customfield_10308',
      'customfield_10016',
      'customfield_10026',
      'customfield_10036',
      'customfield_10106',
      'customfield_10002',
      'customfield_10004',
      'storyPoints'
    ];
    
    for (const fieldName of fieldsToCheck) {
      if (fields[fieldName] !== null && fields[fieldName] !== undefined) {
        const value = Number(fields[fieldName]);
        if (!isNaN(value)) {
          return value;
        }
      }
    }
    return 0;
  };

  const getInProgressTicketsByResource = () => {
    const resourceMap = {};
    
    tickets.forEach(ticket => {
      const status = ticket.fields.status?.name || '';
      const assignee = ticket.fields.assignee?.displayName || 'Unassigned';
      
      // Include both "Dev" and "In Progress" statuses
      if (status === 'Dev' || status === 'In Progress') {
        if (!resourceMap[assignee]) {
          resourceMap[assignee] = [];
        }
        resourceMap[assignee].push(ticket);
      }
    });
    
    return resourceMap;
  };

  const resourceTickets = getInProgressTicketsByResource();
  const sortedResources = Object.entries(resourceTickets).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="resource-quality">
      <h2>In Progress Tickets by Resource</h2>
      
      <div className="what-to-infer">
        <strong>What to Infer?</strong>
        <p>Monitor active work distribution across the team. Yellow highlighted rows indicate resources with 2+ tickets in progress, which may signal multitasking or potential bottlenecks. Red rows show resources with no active work who may be available for new assignments. Check due dates to identify urgent items requiring attention.</p>
      </div>

      <table className="resource-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Ticket</th>
            <th>Epic</th>
            <th>Summary</th>
            <th>Due Date</th>
            <th>Story Points</th>
          </tr>
        </thead>
        <tbody>
          {sortedResources.map(([resource, tickets]) => {
            const rowClass = tickets.length >= 2 ? 'warning-row' : '';
            
            return tickets.map((ticket, index) => {
              const points = getStoryPointValue(ticket);
              const epic = ticket.fields.customfield_10014?.name || 
                          ticket.fields.customfield_10008?.name ||
                          ticket.fields.epic?.name ||
                          ticket.fields.parent?.fields?.summary ||
                          'No Epic';
              const dueDate = ticket.fields.duedate 
                ? new Date(ticket.fields.duedate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'No due date';
              
              return (
                <tr key={ticket.id} className={rowClass}>
                  {index === 0 && (
                    <td rowSpan={tickets.length} className="resource-name">
                      {resource}
                    </td>
                  )}
                  <td>
                    <a 
                      href={`https://highwirepress.atlassian.net/browse/${ticket.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ticket-link"
                    >
                      {ticket.key}
                    </a>
                  </td>
                  <td>{epic}</td>
                  <td className="summary-cell">{ticket.fields.summary}</td>
                  <td>{dueDate}</td>
                  <td className="points-cell">
                    {points > 0 ? (
                      <span className="points-badge">{points} pts</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            });
          })}
          
          {/* Show resources with no in-progress tickets */}
          {(() => {
            const allResources = new Set();
            tickets.forEach(ticket => {
              const assignee = ticket.fields.assignee?.displayName;
              if (assignee) {
                allResources.add(assignee);
              }
            });
            
            const resourcesWithNoWork = Array.from(allResources)
              .filter(resource => !resourceTickets[resource])
              .sort();
            
            return resourcesWithNoWork.map(resource => (
              <tr key={resource} className="no-work-row">
                <td className="resource-name">{resource}</td>
                <td colSpan="5" className="no-tickets-message">No tickets in progress</td>
              </tr>
            ));
          })()}
        </tbody>
      </table>
    </div>
  );
}

export default ResourceQuality;
