'use client'

import { useState, useEffect } from 'react';
import { getEvents, getEventDates, registerSponsorship } from '@/app/actions';
import Calendar from '@/components/Calendar';
import { format } from 'date-fns';
import { Check } from 'lucide-react';

const SPONSORSHIP_PLANS = [
  { id: 'silver', name: 'Annual Silver Sponsorship (1 Samaiya, 1 Mahila Samaiya, 4 Weekly Satsang Sabha)', limits: { event_a: 1, event_b: 1, event_c: 4 }, eligible_events: ['event_a', 'event_b', 'event_c'], price: 1751 },
  { id: 'gold', name: 'Annual Gold Sponsorship (2 Samaiya, 2 Mahila Samaiya, 6 Weekly Satsang Sabha)', limits: { event_a: 2, event_b: 2, event_c: 8 }, eligible_events: ['event_a', 'event_b', 'event_c'], price: 2501 },
  { id: 'platinum', name: 'Annual Platinum Sponsorship (3 Samaiya, 3 Mahila Samaiya, 8 Weekly Satsang Sabha)', limits: { event_a: 3, event_b: 3, event_c: 8 }, eligible_events: ['event_a', 'event_b', 'event_c'], price: 3501 },
  { id: 'all_sabha', name: 'Annual Grand Sponsorships - All Weekly Satsang Sabha', limits: { event_a: 0, event_b: 0, event_c: 999 }, autoSelect: ['event_c'], eligible_events: ['event_c'], price: 7501 },
  { id: 'all_samaiya', name: 'Annual Grand Sponsorships - All Samaiya', limits: { event_a: 999, event_b: 0, event_c: 0 }, autoSelect: ['event_a'], eligible_events: ['event_a'], price: 5001 },
  { id: 'all_sabha_samaiya', name: 'Annual Grand Sponsorships - All Weekly Satsang Sabha & Samaiya', limits: { event_a: 999, event_b: 0, event_c: 999 }, autoSelect: ['event_a', 'event_c'], eligible_events: ['event_a', 'event_c'], price: 11001 },
];

export default function Home() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    spouseFirstName: '',
    lastName: '',
    address: '',
    phone: '',
    email: '',
    sponsorshipType: '',
  });

  const [step3Limits, setStep3Limits] = useState<{ [eventId: string]: number }>({
    event_a: 0,
    event_b: 0,
    event_c: 0,
  });

  const [events, setEvents] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<{ [eventId: string]: string[] }>({});
  const [step2Selections, setStep2Selections] = useState<{ [eventId: string]: string[] }>({});
  const [step3Selections, setStep3Selections] = useState<{ [eventId: string]: string[] }>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadData() {
      const evs = await getEvents();
      setEvents(evs);

      const datesObj: { [eventId: string]: string[] } = {};
      for (const event of evs) {
        const dates = await getEventDates(event.id);
        datesObj[event.id] = dates.map(d => d.date);
      }
      setAvailableDates(datesObj);
    }
    loadData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'sponsorshipType') {
      // Reset selections when changing plans, then apply auto-select if applicable
      let newSelections: { [eventId: string]: string[] } = {};

      if (value !== '') {
        const plan = SPONSORSHIP_PLANS.find(p => p.id === value);
        if (plan && (plan as any).autoSelect) {
          (plan as any).autoSelect.forEach((eventId: string) => {
            newSelections[eventId] = availableDates[eventId] || [];
          });
        }
      }
      setStep2Selections(newSelections);
      setStep3Selections({}); // Also reset step 3 when plan changes
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      const plan = SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType);
      if (plan) {
        const errors: string[] = [];
        Object.entries(plan.limits).forEach(([eventId, limit]: [string, any]) => {
          if (limit === 0) return;

          const selectedForEvent = step2Selections[eventId] || [];
          const availableForEvent = availableDates[eventId] || [];

          // If limit is 999 (All), user must select all available dates
          if (limit >= 999) {
            if (selectedForEvent.length < availableForEvent.length) {
              errors.push(`${events.find(e => e.id === eventId)?.name}: Please select all available dates.`);
            }
          } else {
            // For specific limits, ensure exact match
            const requiredCount = Math.min(limit, availableForEvent.length);
            if (selectedForEvent.length !== requiredCount) {
              errors.push(`${events.find(e => e.id === eventId)?.name}: Please select exactly ${requiredCount} ${requiredCount === 1 ? 'day' : 'days'}.`);
            }
          }
        });

        if (errors.length > 0) {
          alert(`Please complete your selections for the chosen plan:\n\n${errors.join('\n')}`);
          return;
        }
      }

      setStep(3);
    }
  };

  const handleDateClick = (eventId: string, date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');

    // Check if date is locked because selected in other step
    if (step === 2 && (step3Selections[eventId] || []).includes(formattedDate)) return;
    if (step === 3 && (step2Selections[eventId] || []).includes(formattedDate)) return;

    let limit = 0;
    if (step === 2) {
      const plan = SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType);
      if (plan) {
        limit = (plan.limits as any)[eventId] || 0;
      }

      if (limit === 0 && !formData.sponsorshipType) {
        alert("Please select a sponsorship plan first, or click 'Next Step' for individual selection.");
        return;
      }
    } else {
      limit = step3Limits[eventId] || 0;
      if (limit === 0) {
        alert(`Please set a limit for ${events.find(e => e.id === eventId)?.name} first.`);
        return;
      }
    }

    const setSelections = step === 2 ? setStep2Selections : setStep3Selections;
    const currentSelections = step === 2 ? (step2Selections[eventId] || []) : (step3Selections[eventId] || []);

    if (currentSelections.includes(formattedDate)) {
      setSelections(prev => ({
        ...prev,
        [eventId]: (prev[eventId] || []).filter(d => d !== formattedDate)
      }));
    } else {
      if (currentSelections.length < limit) {
        setSelections(prev => ({
          ...prev,
          [eventId]: [...(prev[eventId] || []), formattedDate]
        }));
      } else {
        const type = step === 2 ? "plan limit" : "additional limit";
        alert(`You have reached the ${type} of ${limit} days for ${events.find(e => e.id === eventId)?.name}.`);
      }
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    // Merge selections for backend
    const mergedSelections: { [eventId: string]: string[] } = {};
    events.forEach(event => {
      const s2 = step2Selections[event.id] || [];
      const s3 = step3Selections[event.id] || [];
      const combined = [...new Set([...s2, ...s3])];
      if (combined.length > 0) {
        mergedSelections[event.id] = combined;
      }
    });

    const result = await registerSponsorship(formData, mergedSelections);
    if (result.success) {
      setSubmitted(true);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ background: 'var(--primary)', color: 'white', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <Check size={32} />
          </div>
          <h1 className="page-title">Registration Successful!</h1>
          <p className="page-description mb-6">Thank you for your sponsorship. We have received your application.</p>
          <button onClick={() => window.location.reload()} className="btn-primary">Register Another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Samaiya/Festival Events Sponsorship</h1>
        <p className="page-description">Join us in making these events successful.</p>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="flex justify-between mb-8" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '2px', background: 'var(--border)', zIndex: -1 }}></div>
          <div className={`step-indicator ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`step-indicator ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className={`step-indicator ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        {step === 1 && (
          <form onSubmit={handleNextStep} className="card grid">
            <h2 className="text-xl font-bold">Step 1: Contact Information</h2>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label className="label">First Name</label>
                <input name="firstName" value={formData.firstName} onChange={handleInputChange} required />
              </div>
              <div>
                <label className="label">Spouse First Name</label>
                <input name="spouseFirstName" value={formData.spouseFirstName} onChange={handleInputChange} required />
              </div>
            </div>
            <div>
              <label className="label">Last Name</label>
              <input name="lastName" value={formData.lastName} onChange={handleInputChange} required />
            </div>
            <div>
              <label className="label">Address</label>
              <input name="address" value={formData.address} onChange={handleInputChange} required />
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label className="label">Phone</label>
                <input name="phone" type="tel" value={formData.phone} onChange={handleInputChange} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input name="email" type="email" value={formData.email} onChange={handleInputChange} required />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" className="btn-primary">Next Step</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleNextStep} className="card grid">
            <h2 className="text-xl font-bold">Step 2: Sponsorship Details</h2>
            <div>
              <label className="label">Sponsorship Type</label>
              <select name="sponsorshipType" value={formData.sponsorshipType} onChange={handleInputChange} required>
                <option value="">Select a plan...</option>
                {SPONSORSHIP_PLANS.map(plan => (
                  <option key={plan.id} value={plan.id}>{plan.name} - ${plan.price}</option>
                ))}
              </select>
            </div>

            {formData.sponsorshipType && (
              <div className="grid mt-4">
                <h3 className="font-bold">Select Dates for Events</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Based on your plan, you can select:
                  <br />
                  {Object.entries((SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType)?.limits as any)).map(([ev, limit]: any) => (
                    <span key={ev} className="ml-2 px-2 py-1 bg-secondary rounded text-xs">
                      <b>{events.find(e => e.id === ev)?.name}</b>: {(step2Selections[ev]?.length || 0)}/{limit >= 999 ? 'All' : limit} &nbsp;
                    </span>
                  ))}
                </p>

                <div className="grid" style={{ gap: '2rem' }}>
                  {events
                    .filter(event => {
                      const plan = SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType);
                      return plan?.eligible_events.includes(event.id);
                    })
                    .map(event => {
                      const plan = SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType);
                      const limit = (plan?.limits as any)?.[event.id] || 0;
                      const selectedCount = step2Selections[event.id]?.length || 0;

                      return (
                        <div key={event.id} className="card" style={{ padding: '1.25rem' }}>
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-lg">{event.name}</h4>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${selectedCount >= limit ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                              {selectedCount} / {limit >= 999 ? 'All' : limit} Selected
                            </span>
                          </div>

                          <div className="flex" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                            {availableDates[event.id]?.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">No dates available for this event yet.</p>
                            ) : (
                              availableDates[event.id]?.map(dateStr => {
                                const isSelectedInStep2 = (step2Selections[event.id] || []).includes(dateStr);
                                const isSelectedFromStep3 = (step3Selections[event.id] || []).includes(dateStr);
                                const isDisabled = (!isSelectedInStep2 && selectedCount >= limit) || isSelectedFromStep3;

                                return (
                                  <button
                                    key={dateStr}
                                    type="button"
                                    onClick={() => handleDateClick(event.id, new Date(dateStr + 'T12:00:00'))} // Use middle of day to avoid TZ issues
                                    disabled={isDisabled}
                                    className={`date-chip ${isSelectedInStep2 ? 'selected' : ''} ${isSelectedFromStep3 ? 'step2-selected' : ''}`}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      borderRadius: '2rem',
                                      border: '1px solid var(--border)',
                                      background: isSelectedFromStep3 ? '#22c55e' : (isSelectedInStep2 ? 'var(--primary)' : 'var(--card)'),
                                      color: (isSelectedInStep2 || isSelectedFromStep3) ? 'white' : 'inherit',
                                      opacity: isDisabled && !isSelectedFromStep3 ? 0.4 : 1,
                                      fontSize: '0.875rem',
                                      cursor: isSelectedFromStep3 ? 'default' : (isDisabled ? 'not-allowed' : 'pointer'),
                                      pointerEvents: isSelectedFromStep3 ? 'none' : 'auto'
                                    }}
                                  >
                                    {format(new Date(dateStr + 'T12:00:00'), 'MMM d, yyyy')}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary"
              >
                Back
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                Next Step
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="card grid">
            <h2 className="text-xl font-bold">Step 3: Individual Event Selection</h2>
            <p className="text-sm text-muted-foreground">Select how many days you want for each event and pick your dates.</p>

            <div className="grid" style={{ gap: '2rem' }}>
              {events.map(event => {
                const plan = SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType);
                const planLimit = (plan?.limits as any)?.[event.id] || 0;

                // Requirement 1: If all available dates are selected in Step 2, hide this event
                const eventAvailableDates = availableDates[event.id] || [];
                const step2EventSelections = step2Selections[event.id] || [];
                const allDatesSelected = eventAvailableDates.length > 0 &&
                  eventAvailableDates.every(d => step2EventSelections.includes(d));

                if (allDatesSelected) return null;

                const individualLimit = step3Limits[event.id] || 0;
                const selectedCount = step3Selections[event.id]?.length || 0;

                return (
                  <div key={event.id} className="card" style={{ padding: '1.25rem' }}>
                    <div className="grid mb-4" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                      <h4 className="font-bold text-lg">{event.name}</h4>
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium">Add Limit:</label>
                        <select
                          value={individualLimit}
                          onChange={(e) => {
                            const newIndivLimit = parseInt(e.target.value);
                            setStep3Limits(prev => ({ ...prev, [event.id]: newIndivLimit }));

                            // Clear selections if new limit is smaller
                            if (selectedCount > newIndivLimit) {
                              setStep3Selections(prev => ({
                                ...prev,
                                [event.id]: prev[event.id].slice(0, newIndivLimit)
                              }));
                            }
                          }}
                          style={{ width: '80px', padding: '0.25rem 0.5rem' }}
                        >
                          <option value="0">0</option>
                          {[1, 2, 3, 4, 5].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(individualLimit > 0 || (step2Selections[event.id]?.length || 0) > 0) && (
                      <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs text-muted-foreground">Available Dates</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${selectedCount >= individualLimit ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                            {selectedCount} / {individualLimit} Selected
                          </span>
                        </div>

                        <div className="flex" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                          {availableDates[event.id]?.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No dates available for this event.</p>
                          ) : (
                            availableDates[event.id]?.map(dateStr => {
                              const isSelectedFromStep2 = (step2Selections[event.id] || []).includes(dateStr);
                              const isSelectedInStep3 = (step3Selections[event.id] || []).includes(dateStr);
                              const isDisabled = isSelectedFromStep2 || (!isSelectedInStep3 && selectedCount >= individualLimit);

                              return (
                                <button
                                  key={dateStr}
                                  type="button"
                                  onClick={() => handleDateClick(event.id, new Date(dateStr + 'T12:00:00'))}
                                  disabled={isDisabled}
                                  className={`date-chip ${isSelectedInStep3 ? 'selected' : ''} ${isSelectedFromStep2 ? 'step2-selected' : ''}`}
                                  style={{
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '2rem',
                                    border: '1px solid var(--border)',
                                    background: isSelectedFromStep2 ? '#22c55e' : (isSelectedInStep3 ? 'var(--primary)' : 'var(--card)'),
                                    color: (isSelectedInStep3 || isSelectedFromStep2) ? 'white' : 'inherit',
                                    opacity: isDisabled && !isSelectedFromStep2 ? 0.4 : 1,
                                    fontSize: '0.75rem',
                                    cursor: isSelectedFromStep2 ? 'default' : (isDisabled ? 'not-allowed' : 'pointer'),
                                    pointerEvents: isSelectedFromStep2 ? 'none' : 'auto'
                                  }}
                                >
                                  {format(new Date(dateStr + 'T12:00:00'), 'MMM d, yyyy')}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Complete Registration'}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
