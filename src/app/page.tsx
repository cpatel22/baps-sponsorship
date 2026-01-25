'use client'

import { useState, useEffect } from 'react';
import { getEvents, getEventDates, registerSponsorship } from '@/app/actions';
import Calendar from '@/components/Calendar';
import { format } from 'date-fns';
import { Check, Plus, Minus } from 'lucide-react';

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

  const [step3Limits, setStep3Limits] = useState<{ [eventId: string]: number | string }>({
    event_a: 0,
    event_b: 0,
    event_c: 0,
  });

  const [events, setEvents] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<{ [eventId: string]: { date: string, title?: string }[] }>({});
  const [step2Selections, setStep2Selections] = useState<{ [eventId: string]: string[] }>({});
  const [step3Selections, setStep3Selections] = useState<{ [eventId: string]: string[] }>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const showAlert = (message: string) => {
    setModalMessage(message);
    setShowModal(true);
  };

  useEffect(() => {
    async function loadData() {
      const evs = await getEvents();
      setEvents(evs);

      const datesObj: { [eventId: string]: { date: string, title?: string }[] } = {};
      for (const event of evs) {
        const dates = await getEventDates(event.id);
        datesObj[event.id] = dates;
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
            newSelections[eventId] = (availableDates[eventId] || []).map(d => d.date);
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
          const availableForEvent = (availableDates[eventId] || []).map(d => d.date);

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
          showAlert(`Please complete your selections for the chosen plan:\n\n${errors.join('\n')}`);
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

    let limit: number = 0;
    if (step === 2) {
      const plan = SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType);
      if (plan) {
        limit = (plan.limits as any)[eventId] || 0;
      }

      if (limit === 0 && !formData.sponsorshipType) {
        showAlert("Please select a sponsorship plan first, or click 'Next Step' for individual selection.");
        return;
      }
    } else {
      const rawLimit = step3Limits[eventId] || 0;
      if (rawLimit === 'ALL') {
        limit = (availableDates[eventId] || []).length;
      } else {
        limit = rawLimit as number;
      }

      if (limit === 0) {
        showAlert(`Please set a limit for ${events.find(e => e.id === eventId)?.name} first.`);
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
        showAlert(`You have reached the ${type} of ${limit} days for ${events.find(e => e.id === eventId)?.name}.`);
      }
    }
  };

  const calculateGrandTotal = () => {
    let total = 0;
    const plan = SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType);
    if (plan) {
      total += plan.price;
    }

    // Individual costs from Step 3
    events.forEach(event => {
      const individualLimit = step3Limits[event.id] || 0;
      if (individualLimit === 'ALL') {
        total += event.allCost || 0;
      } else {
        total += (individualLimit as number) * (event.individualCost || 0);
      }
    });

    return total;
  };

  const handleSubmit = async () => {
    setLoading(true);

    // Merge selections for backend
    const mergedSelections: { [eventId: string]: string[] } = {};
    events.forEach(event => {
      const s2 = step2Selections[event.id] || [];
      const s3 = step3Selections[event.id] || [];
      const combined = [...new Set([...s2, ...s3])];
      
      // For events without date selection in step3, add a placeholder to indicate selection
      const step3Limit = step3Limits[event.id];
      if (event.dateSelectionRequired === false && step3Limit && step3Limit !== 0) {
        // Use empty array with at least one entry to indicate this event is selected
        if (combined.length === 0) {
          combined.push('no-date-required');
        }
      }
      
      if (combined.length > 0) {
        mergedSelections[event.id] = combined;
      }
    });

    // Add step2 and step3 data to formData for email
    const completeFormData = {
      ...formData,
      step2Selections,
      step3Limits
    };

    const result = await registerSponsorship(completeFormData, mergedSelections);
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
          <button onClick={() => window.location.reload()} className="btn-primary hidden">Register Another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Samaiya/Festival Events Sponsorship</h1>
        <p className="page-description hidden">Join us in making these events successful.</p>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="flex justify-between mb-8" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '2px', background: 'var(--border)', zIndex: -1 }}></div>
          <div className={`step-indicator ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`step-indicator ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className={`step-indicator ${step >= 3 ? 'active' : ''}`}>3</div>
          <div className={`step-indicator ${step >= 4 ? 'active' : ''}`}>4</div>
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
            <div className="flex justify-between mt-4">
              <div></div>
              <button type="submit" className="btn-primary">Next Step</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleNextStep} className="card grid">
            <h2 className="text-xl font-bold">Step 2: Sponsorship Details</h2>
            <div>
              <label className="label">Sponsorship Type</label>
              <select name="sponsorshipType" value={formData.sponsorshipType} onChange={handleInputChange}>
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
                              availableDates[event.id]?.map(dateObj => {
                                const isSelectedInStep2 = (step2Selections[event.id] || []).includes(dateObj.date);
                                const isSelectedFromStep3 = (step3Selections[event.id] || []).includes(dateObj.date);
                                const isDisabled = (!isSelectedInStep2 && selectedCount >= limit) || isSelectedFromStep3;

                                return (
                                  <button
                                    key={dateObj.date}
                                    type="button"
                                    onClick={() => handleDateClick(event.id, new Date(dateObj.date + 'T12:00:00'))} // Use middle of day to avoid TZ issues
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
                                    {(() => {
                                      try {
                                        return format(new Date(dateObj.date + 'T12:00:00'), 'MMM d, yyyy');
                                      } catch {
                                        return dateObj.date;
                                      }
                                    })()}
                                    {dateObj.title && ` - ${dateObj.title}`}
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

            {formData.sponsorshipType && (
              <div className="text-right mt-4">
                <span className="text-xl font-bold">
                  Total: <span className="text-primary">${calculateGrandTotal()}</span>
                </span>
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
                {formData.sponsorshipType ? 'Next Step' : 'Skip & Next Step'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="card grid">
            <h2 className="text-xl font-bold">Step 3: Individual Events</h2>
            <p className="text-sm text-muted-foreground hidden">Select how many days you want for each event and pick your dates.</p>

            <div className="grid" style={{ gap: '2rem' }}>
              {events.map(event => {
                const plan = SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType);
                const planLimit = (plan?.limits as any)?.[event.id] || 0;

                // Requirement 1: If all available dates are selected in Step 2, hide this event
                const eventAvailableDates = (availableDates[event.id] || []).map(d => d.date);
                const step2EventSelections = step2Selections[event.id] || [];
                const allDatesSelected = eventAvailableDates.length > 0 &&
                  eventAvailableDates.every(d => step2EventSelections.includes(d));

                if (allDatesSelected) return null;

                const individualLimit = step3Limits[event.id] || 0;
                const isAllSelected = individualLimit === 'ALL';

                const maxAvailableDates = eventAvailableDates.length - step2EventSelections.length;
                const limitSource = event.dateSelectionRequired === true ? maxAvailableDates : (event.individualUpto || 0);

                const effectiveLimit = isAllSelected ? maxAvailableDates : (individualLimit as number);
                const selectedCount = step3Selections[event.id]?.length || 0;
                const currentCost = isAllSelected ? event.allCost : (individualLimit as number) * (event.individualCost || 0);

                return (
                  <div key={event.id} className="card" style={{ padding: '1.25rem' }}>
                    <div className="table-cell" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                      <h4 className="font-bold text-lg">
                        {event.name} {event.individualCost > 0 && (
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            (${event.individualCost} each{event.allCost ? ` / $${event.allCost} for all` : ''})
                          </span>
                        )}
                      </h4>
                      <div className="flex flex-col items-end gap-1">
                        <div
                          className="flex items-center rounded-lg border border-[#d1d5db] bg-white overflow-hidden shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary"
                          style={{ height: '36px' }}
                        >
                          {/* Prepend: Minus Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const current = typeof individualLimit === 'number' ? individualLimit : 0;
                              const newVal = Math.max(0, current - 1);
                              setStep3Limits(prev => ({ ...prev, [event.id]: newVal }));
                              if (selectedCount > newVal) {
                                setStep3Selections(prev => ({ ...prev, [event.id]: (prev[event.id] || []).slice(0, newVal) }));
                              }
                            }}
                            className="w-10 h-full hover:bg-black/5 flex items-center justify-center transition-colors bg-[#f3f4f6]"
                            disabled={isAllSelected || individualLimit === 0}
                          >
                            <span className={`text-xl leading-none text-[#374151] ${isAllSelected || individualLimit === 0 ? 'opacity-20' : ''}`} style={{ marginTop: '-1px' }}>−</span>
                          </button>

                          {/* Center: Value Display (Styled as Input) */}
                          <div className="w-16 h-full flex items-center justify-center text-center font-semibold text-black text-lg border-x border-[#d1d5db] bg-white">
                            {isAllSelected ? '∞' : (individualLimit || 0)}
                          </div>

                          {/* Append: Plus Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isAllSelected) return;
                              const current = typeof individualLimit === 'number' ? individualLimit : 0;
                              const newVal = current + 1;

                              if (event.allCost !== null && (newVal * event.individualCost) >= event.allCost) {
                                setStep3Limits(prev => ({ ...prev, [event.id]: 'ALL' }));
                                if (event.dateSelectionRequired === true) {
                                  const allDates = (availableDates[event.id] || []).map(d => d.date);
                                  const s2 = step2Selections[event.id] || [];
                                  setStep3Selections(prev => ({
                                    ...prev,
                                    [event.id]: allDates.filter(d => !s2.includes(d))
                                  }));
                                }
                              } else if (newVal <= (limitSource as number)) {
                                setStep3Limits(prev => ({ ...prev, [event.id]: newVal }));
                              }
                            }}
                            className="w-10 h-full hover:bg-black/5 flex items-center justify-center transition-colors bg-[#f3f4f6]"
                            disabled={isAllSelected || individualLimit >= limitSource}
                          >
                            <span className={`text-xl leading-none text-[#374151] ${isAllSelected || (individualLimit as number) >= limitSource ? 'opacity-20' : ''}`}>+</span>
                          </button>

                          {/* Outer Append: ALL Button */}
                          {event.allCost !== null && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isAllSelected) {
                                  setStep3Limits(prev => ({ ...prev, [event.id]: 0 }));
                                  setStep3Selections(prev => ({ ...prev, [event.id]: [] }));
                                } else {
                                  setStep3Limits(prev => ({ ...prev, [event.id]: 'ALL' }));
                                  if (event.dateSelectionRequired === true) {
                                    const allDates = (availableDates[event.id] || []).map(d => d.date);
                                    const s2 = step2Selections[event.id] || [];
                                    setStep3Selections(prev => ({
                                      ...prev,
                                      [event.id]: allDates.filter(d => !s2.includes(d))
                                    }));
                                  }
                                }
                              }}
                              className={`px-4 h-full text-xs font-bold transition-all border-l border-[#d1d5db] ${isAllSelected
                                ? 'bg-destructive text-white hover:bg-destructive/90'
                                : 'bg-white text-primary hover:bg-primary/5'
                                }`}
                            >
                              {isAllSelected ? 'CLEAR' : 'ALL'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {event.dateSelectionRequired === true && (effectiveLimit > 0 || (step2Selections[event.id]?.length || 0) > 0) && (
                      <fieldset className="card-dates">
                        <legend className="px-2 flex items-center gap-2 -ml-1">
                          <span className="text-xs font-bold uppercase tracking-widest text-[#64748b] hidden">Available Dates</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ${selectedCount >= effectiveLimit ? 'bg-primary text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                            {selectedCount} / {isAllSelected ? 'All' : effectiveLimit} Selected
                          </span>
                        </legend>

                        <div className="flex pt-2" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                          {availableDates[event.id]?.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No dates available for this event.</p>
                          ) : (
                            availableDates[event.id]?.map(dateObj => {
                              const isSelectedFromStep2 = (step2Selections[event.id] || []).includes(dateObj.date);
                              const isSelectedInStep3 = (step3Selections[event.id] || []).includes(dateObj.date);
                              const isDisabled = isSelectedFromStep2 || (!isSelectedInStep3 && selectedCount >= effectiveLimit);

                              return (
                                <button
                                  key={dateObj.date}
                                  type="button"
                                  onClick={() => handleDateClick(event.id, new Date(dateObj.date + 'T12:00:00'))}
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
                                  {(() => {
                                    try {
                                      return format(new Date(dateObj.date + 'T12:00:00'), 'MMM d, yyyy');
                                    } catch {
                                      return dateObj.date;
                                    }
                                  })()}
                                  {dateObj.title && ` - ${dateObj.title}`}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </fieldset>
                    )}
                    {currentCost > 0 && (
                      <div className="text-right mt-2">
                        <hr className="border-border mt-2" />
                        <span className="text-xl font-bold">
                          Total: <span className="text-primary">${currentCost}</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-right border-t-2 border-border">
              <span className="text-2xl font-black">
                Grand Total: <span className="text-primary">${calculateGrandTotal()}</span>
              </span>
            </div>

            <div className="flex justify-between mt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  // Validate that all events with limits have the required number of dates selected
                  const errors: string[] = [];
                  
                  events.forEach(event => {
                    const limit = step3Limits[event.id];
                    
                    // Skip if no limit or limit is 0 or event doesn't require date selection
                    if (!limit || limit === 0 || event.dateSelectionRequired !== true) return;
                    
                    const selectedCount = (step3Selections[event.id] || []).length;
                    
                    if (limit === 'ALL') {
                      // For ALL, calculate how many dates should be selected (total - step2 dates)
                      const allDates = (availableDates[event.id] || []).map(d => d.date);
                      const step2Dates = step2Selections[event.id] || [];
                      const requiredCount = allDates.length - step2Dates.length;
                      
                      if (selectedCount < requiredCount) {
                        errors.push(`${event.name}: You must select all ${requiredCount} available date${requiredCount > 1 ? 's' : ''} (currently selected: ${selectedCount})`);
                      }
                    } else {
                      // For specific number, check if enough dates are selected
                      const requiredCount = limit as number;
                      
                      if (selectedCount < requiredCount) {
                        errors.push(`${event.name}: You must select ${requiredCount} date${requiredCount > 1 ? 's' : ''} (currently selected: ${selectedCount})`);
                      }
                    }
                  });
                  
                  if (errors.length > 0) {
                    showAlert('Please complete your date selections:\n\n' + errors.join('\n'));
                    return;
                  }
                  
                  setStep(4);
                }}
                className="btn-primary"
              >
                Review Summary
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="card grid">
            <h2 className="text-xl font-bold">Step 4: Order Summary</h2>
            <p className="text-sm text-muted-foreground">Review your sponsorship details before submitting.</p>

            {/* Contact Information */}
            <div className="card" style={{ background: 'var(--secondary)', padding: '1rem' }}>
              <h3 className="font-bold text-lg mb-3">Contact Information</h3>
              <div className="grid" style={{ gap: '0.5rem', fontSize: '0.9rem' }}>
                <div><strong>Name:</strong> {formData.firstName} & {formData.spouseFirstName} {formData.lastName}</div>
                <div><strong>Address:</strong> {formData.address}</div>
                <div><strong>Phone:</strong> {formData.phone}</div>
                <div><strong>Email:</strong> {formData.email}</div>
              </div>
            </div>

            {/* Sponsorship Plan */}
            {formData.sponsorshipType && (
              <div className="card" style={{ background: 'var(--secondary)', padding: '1rem' }}>
                <h3 className="font-bold text-lg mb-2">Sponsorship Plan</h3>
                <div className="text-base">
                  {SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType)?.name}
                </div>
                <div className="text-right mt-2 pt-2 border-t border-border">
                  <span className="text-lg font-bold text-primary">
                    ${SPONSORSHIP_PLANS.find(p => p.id === formData.sponsorshipType)?.price || 0}
                  </span>
                </div>
              </div>
            )}

            {/* Step 2 Selections */}
            {Object.keys(step2Selections).some(eventId => step2Selections[eventId]?.length > 0) && (
              <div className="card" style={{ background: 'var(--secondary)', padding: '1rem' }}>
                <h3 className="font-bold text-lg mb-3">Plan Event Selections</h3>
                {events.map(event => {
                  const selections = step2Selections[event.id] || [];
                  if (selections.length === 0) return null;
                  return (
                    <div key={event.id} className="mb-3 pb-3 border-b border-border last:border-0 last:mb-0 last:pb-0">
                      <div className="font-semibold text-base mb-2">{event.name}</div>
                      <div className="flex flex-wrap gap-2">
                        {selections.map(date => {
                          const dateObj = availableDates[event.id]?.find(d => d.date === date);
                          return (
                            <span key={date} className="text-xs px-2 py-1 bg-white rounded-full border border-primary text-primary">
                              {(() => {
                                try {
                                  return format(new Date(date + 'T12:00:00'), 'MMM d, yyyy');
                                } catch {
                                  return date;
                                }
                              })()}
                              {dateObj?.title && ` - ${dateObj.title}`}
                            </span>
                          );
                        })}
                      </div>
                      <div className="text-right mt-2 text-sm">
                        <span className="font-semibold">{selections.length} date{selections.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Step 3 Individual Event Selections */}
            {(Object.keys(step3Limits).some(eventId => step3Limits[eventId] === 'ALL' || (step3Limits[eventId] as number) > 0)) && (
              <div className="card" style={{ background: 'var(--secondary)', padding: '1rem' }}>
                <h3 className="font-bold text-lg mb-3">Individual Event Selections</h3>
                {events.map(event => {
                  const limit = step3Limits[event.id];
                  const isAllSelected = limit === 'ALL';
                  const selections = step3Selections[event.id] || [];
                  const individualCost = isAllSelected ? event.allCost : (limit as number) * (event.individualCost || 0);
                  
                  // Skip if no limit or limit is 0
                  if (!limit || limit === 0) return null;
                  
                  return (
                    <div key={event.id} className="mb-3 pb-3 border-b border-border last:border-0 last:mb-0 last:pb-0">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-base">{event.name}</div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">
                            {isAllSelected ? 'All' : limit} × ${event.individualCost}
                          </div>
                          <div className="font-bold text-primary">${individualCost}</div>
                        </div>
                      </div>
                      {event.dateSelectionRequired === true && selections.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selections.map(date => {
                            const dateObj = availableDates[event.id]?.find(d => d.date === date);
                            return (
                              <span key={date} className="text-xs px-2 py-1 bg-white rounded-full border border-primary text-primary">
                                {(() => {
                                  try {
                                    return format(new Date(date + 'T12:00:00'), 'MMM d, yyyy');
                                  } catch {
                                    return date;
                                  }
                                })()}
                                {dateObj?.title && ` - ${dateObj.title}`}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {event.dateSelectionRequired === false && (
                        <div className="text-sm text-muted-foreground mt-2">
                          {isAllSelected ? 'All' : limit}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Grand Total */}
            <div className="card" style={{ background: 'var(--primary)', color: 'white', padding: '1.5rem', textAlign: 'center' }}>
              <div className="text-sm uppercase tracking-wider opacity-90 mb-1">Total Amount</div>
              <div className="text-4xl font-black">${calculateGrandTotal()}</div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-4">
              <button
                type="button"
                onClick={() => setStep(3)}
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

      {/* Modal Popup */}
      {showModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              animation: 'slideIn 0.2s ease-out'
            }}
          >
            <div style={{ 
              background: 'var(--primary)', 
              color: 'white', 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 1.5rem',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              !
            </div>
            <p style={{ 
              fontSize: '1.125rem', 
              textAlign: 'center', 
              marginBottom: '1.5rem',
              color: 'var(--text)',
              lineHeight: '1.6'
            }}>
              {modalMessage}
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
