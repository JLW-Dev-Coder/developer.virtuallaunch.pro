// functions/forms/clientReference.js
// Client-side utilities for onboarding form submission and status checks.
// Handles eventId generation, canonical response shapes (success / deduped / error),
// and DOM wiring for form submit events.
// Counterpart Worker route: /forms/onboarding

const generateEventId = () => `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/**
 * Submit the onboarding form
 * @param {Object} formData - All form fields
 * @returns {Object} - Response object from the Worker
 */
export async function submitOnboardingForm(formData) {
  const eventId = generateEventId();
  const payload = { eventId, ...formData };

  try {
    const res = await fetch('/forms/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    // Handle deduped submission
    if (data.deduped) {
      return {
        ok: true,
        deduped: true,
        message: 'You have already submitted this form. Your previous submission is on file.',
        eventId: data.eventId
      };
    }

    // Normal submission response
    if (data.ok) {
      return { ok: true, eventId: data.eventId, status: data.status };
    }

    // Error response
    return { ok: false, error: data.error || 'unknown_error' };
  } catch (err) {
    console.error('Submission failed', err);
    return { ok: false, error: 'network_error' };
  }
}

/**
 * Check client application status by reference ID
 * @param {string} referenceId
 * @returns {Object} - Status result
 */
export async function checkClientStatus(referenceId) {
  if (!referenceId) return { ok: false, error: 'no_reference' };

  try {
    // TODO: verify endpoint against contract
    const res = await fetch(`/forms/onboarding/status?referenceId=${encodeURIComponent(referenceId)}`);
    const data = await res.json();

    if (data.ok) {
      return {
        ok: true,
        status: data.status,
        referenceId,
        lastUpdated: data.lastUpdated || new Date().toISOString()
      };
    }

    return { ok: false, error: data.error || 'not_found' };
  } catch (err) {
    console.error('Status check failed', err);
    return { ok: false, error: 'network_error' };
  }
}

/**
 * Helper to handle form submit events
 * Example usage:
 *   const result = await submitOnboardingForm(formData);
 *   if(result.deduped) showDedupedMessage(result.message);
 */
export function handleFormSubmit(formElement, statusElement, dedupedElement) {
  formElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = Object.fromEntries(new FormData(formElement));
    const result = await submitOnboardingForm(formData);

    if (result.ok && result.deduped) {
      dedupedElement.textContent = result.message;
      dedupedElement.classList.remove('hidden');
      statusElement.classList.add('hidden');
    } else if (result.ok) {
      dedupedElement.classList.add('hidden');
      statusElement.textContent = `Submission successful! Event ID: ${result.eventId}`;
      statusElement.classList.remove('hidden');
    } else {
      dedupedElement.classList.add('hidden');
      statusElement.textContent = `Error: ${result.error}`;
      statusElement.classList.remove('hidden');
    }
  });
}
