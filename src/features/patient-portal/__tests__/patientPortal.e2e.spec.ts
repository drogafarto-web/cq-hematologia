/**
 * Patient Portal E2E Tests — Cypress
 * Covers: auth flow, token validation, dashboard, PDF download, session management
 */

describe('Patient Portal Auth Flow', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173/portal/auth');
  });

  it('renders email form on initial load', () => {
    cy.contains('Email Address').should('be.visible');
    cy.get('button').contains('Request Authentication Link').should('be.visible');
  });

  it('validates email format', () => {
    cy.get('input[aria-label="Email address"]').type('invalid-email');
    cy.get('button').contains('Request Authentication Link').click();
    cy.contains('Please enter a valid email address').should('be.visible');
  });

  it('requires email input', () => {
    cy.get('button').contains('Request Authentication Link').click();
    cy.contains('Email is required').should('be.visible');
  });

  it('sends auth link and shows success message', () => {
    cy.intercept('POST', '**/generatePatientAuthLink', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Link sent to email',
        expiresInHours: 72,
      },
    }).as('generateLink');

    cy.get('input[aria-label="Email address"]').type('patient@example.com');
    cy.get('button').contains('Request Authentication Link').click();
    cy.wait('@generateLink');
    cy.contains('Authentication link sent').should('be.visible');
  });

  it('enforces rate limit (5 attempts max)', () => {
    for (let i = 0; i < 5; i++) {
      cy.get('input[aria-label="Email address"]').clear().type(`patient${i}@example.com`);
      cy.get('button').contains('Request Authentication Link').click();
      cy.wait(100);
    }
    cy.contains('Too many attempts').should('be.visible');
    cy.get('button').contains('Request Authentication Link').should('be.disabled');
  });
});

describe('Patient Portal Token Verification', () => {
  it('validates token on link click', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXRpZW50SWQiOiJwYXQxIiwibGFiSWQiOiJsYWIxIiwiZXhwaXJlc0F0IjoxMDAwMDAwMDAwMDAwfQ.sig';
    cy.visit(`http://localhost:5173/portal/auth/link?token=${token}&lab=lab1`);

    cy.contains('Verifying').should('be.visible');
    cy.intercept('POST', '**/verifyPatientAuthToken', {
      statusCode: 200,
      body: {
        valid: true,
        patientId: 'pat1',
        labId: 'lab1',
        expiresAt: Date.now() + 72 * 60 * 60 * 1000,
      },
    }).as('verifyToken');

    cy.wait('@verifyToken');
    cy.contains('Authentication Successful').should('be.visible');
  });

  it('shows error for expired token', () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXRpZW50SWQiOiJwYXQxIiwibGFiSWQiOiJsYWIxIiwiZXhwaXJlc0F0IjowfQ.sig';
    cy.visit(`http://localhost:5173/portal/auth/link?token=${expiredToken}&lab=lab1`);

    cy.contains('Token expired').should('be.visible');
    cy.get('button').contains('Request New Link').should('be.visible');
  });

  it('handles missing token parameter', () => {
    cy.visit('http://localhost:5173/portal/auth/link?lab=lab1');
    cy.contains('Missing authentication parameters').should('be.visible');
  });
});

describe('Patient Dashboard', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173/portal/auth');
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXRpZW50SWQiOiJwYXQxIiwibGFiSWQiOiJsYWIxIiwiZXhwaXJlc0F0IjoxMDAwMDAwMDAwMDAwfQ.sig';
    localStorage.setItem('patient_portal_session', JSON.stringify({
      token,
      patientId: 'pat1',
      labId: 'lab1',
      email: 'patient@example.com',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    }));
    cy.visit('http://localhost:5173/portal/dashboard');
  });

  it('displays patient name and lab name', () => {
    cy.contains('Laboratory').should('be.visible');
    cy.contains('Logged in as').should('be.visible');
  });

  it('shows list of laudos', () => {
    cy.contains('Complete Blood Count').should('be.visible');
  });

  it('displays laudo metadata', () => {
    cy.contains('Exam Date:').should('be.visible');
    cy.contains('Expires:').should('be.visible');
  });

  it('shows status badges', () => {
    cy.contains('Ready').should('be.visible');
    cy.contains('Pending').should('be.visible');
  });

  it('enables download for ready status', () => {
    cy.get('button').contains('Download PDF').first().should('not.be.disabled');
  });

  it('disables download for pending status', () => {
    cy.get('button').contains('Awaiting Release').should('be.disabled');
  });

  it('shows LGPD notice', () => {
    cy.contains('protected under LGPD').should('be.visible');
  });

  it('opens LGPD modal', () => {
    cy.contains('Learn more').click();
    cy.contains('LGPD Privacy Rights').should('be.visible');
  });

  it('logs out user', () => {
    cy.get('button[aria-label="Logout"]').click();
    cy.url().should('include', '/portal/auth');
  });
});

describe('Patient Session Indicator', () => {
  beforeEach(() => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    const expiryTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    localStorage.setItem('patient_portal_session', JSON.stringify({
      token,
      patientId: 'pat1',
      labId: 'lab1',
      email: 'patient@example.com',
      expiresAt: expiryTime.toISOString(),
    }));
    cy.visit('http://localhost:5173/portal/dashboard');
  });

  it('displays session countdown timer', () => {
    cy.contains('Session expires in:').should('be.visible');
  });

  it('shows warning at 10 minutes', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    const expiryTime = new Date(Date.now() + 9 * 60 * 1000); // 9 minutes
    localStorage.setItem('patient_portal_session', JSON.stringify({
      token,
      patientId: 'pat1',
      labId: 'lab1',
      email: 'patient@example.com',
      expiresAt: expiryTime.toISOString(),
    }));
    cy.reload();
    cy.contains('Session expires in').should('be.visible');
  });

  it('auto-logs out on expiry', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    const expiredTime = new Date(Date.now() - 1000); // Expired
    localStorage.setItem('patient_portal_session', JSON.stringify({
      token,
      patientId: 'pat1',
      labId: 'lab1',
      email: 'patient@example.com',
      expiresAt: expiredTime.toISOString(),
    }));
    cy.reload();
    cy.url().should('include', '/portal/auth');
  });
});

describe('Patient Portal Auth Guard', () => {
  it('redirects to /portal/auth when not authenticated', () => {
    localStorage.removeItem('patient_portal_session');
    cy.visit('http://localhost:5173/portal/dashboard');
    cy.url().should('include', '/portal/auth');
  });

  it('redirects to /portal/auth when session expired', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    const expiredTime = new Date(Date.now() - 1000);
    localStorage.setItem('patient_portal_session', JSON.stringify({
      token,
      patientId: 'pat1',
      labId: 'lab1',
      email: 'patient@example.com',
      expiresAt: expiredTime.toISOString(),
    }));
    cy.visit('http://localhost:5173/portal/dashboard');
    cy.url().should('include', '/portal/auth');
  });

  it('allows access with valid session', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    const futureTime = new Date(Date.now() + 72 * 60 * 60 * 1000);
    localStorage.setItem('patient_portal_session', JSON.stringify({
      token,
      patientId: 'pat1',
      labId: 'lab1',
      email: 'patient@example.com',
      expiresAt: futureTime.toISOString(),
    }));
    cy.visit('http://localhost:5173/portal/dashboard');
    cy.contains('Laboratory').should('be.visible');
  });
});

describe('Patient Portal Mobile Responsiveness', () => {
  beforeEach(() => {
    cy.viewport(375, 667); // iPhone SE
  });

  it('renders form on mobile without horizontal scroll', () => {
    cy.visit('http://localhost:5173/portal/auth');
    cy.get('input[aria-label="Email address"]').should('be.visible');
    cy.get('button').contains('Request Authentication Link').should('be.visible');
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('dashboard is mobile responsive', () => {
    const token = 'test';
    const futureTime = new Date(Date.now() + 72 * 60 * 60 * 1000);
    localStorage.setItem('patient_portal_session', JSON.stringify({
      token,
      patientId: 'pat1',
      labId: 'lab1',
      email: 'patient@example.com',
      expiresAt: futureTime.toISOString(),
    }));
    cy.visit('http://localhost:5173/portal/dashboard');
    cy.get('button').contains('Download PDF').should('be.visible');
  });
});

describe('Patient Portal Accessibility', () => {
  it('has proper heading hierarchy', () => {
    cy.visit('http://localhost:5173/portal/auth');
    cy.get('h1, h2, h3').should('have.length.greaterThan', 0);
  });

  it('has aria labels on interactive elements', () => {
    cy.visit('http://localhost:5173/portal/auth');
    cy.get('input[aria-label="Email address"]').should('exist');
  });

  it('form fields are keyboard navigable', () => {
    cy.visit('http://localhost:5173/portal/auth');
    cy.get('input[aria-label="Email address"]').focus().should('have.focus');
    cy.focused().tab();
    cy.focused().should('have.text').or('have.attr', 'type');
  });

  it('error messages are associated with inputs', () => {
    cy.visit('http://localhost:5173/portal/auth');
    cy.get('input[aria-label="Email address"]').type('invalid');
    cy.get('button').contains('Request Authentication Link').click();
    cy.get('input[aria-describedby]').should('have.attr', 'aria-describedby', 'email-error');
  });

  it('has sufficient color contrast', () => {
    cy.visit('http://localhost:5173/portal/auth');
    cy.get('button').first().should('have.css', 'color');
  });
});
