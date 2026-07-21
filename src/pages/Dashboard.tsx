import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Task = {
  id: string
  user_id: string
  title: string
  notes: string | null
  reason: string | null
  deadline: string | null
  priority: 'low' | 'medium' | 'high'
  estimated_minutes: number | null
  actual_focus_minutes: number
  completed: boolean
  created_at: string
}

type CalendarEvent = {
  id: string
  user_id: string
  title: string
  event_type: 'test' | 'assignment' | 'personal' | 'other'
  event_date: string
  reminder_at: string | null
  notes: string | null
  created_at: string
}

type TestRow = {
  id: string
  calendar_event_id: string
  user_id: string
  subject: string
  preparation_status: 'not_started' | 'in_progress' | 'ready'
  study_progress: number
  created_at: string
}

type CalendarEventWithTest = CalendarEvent & {
  test: TestRow | null
}

type TaskFormState = {
  title: string
  reason: string
  notes: string
  deadline: string
  priority: 'low' | 'medium' | 'high'
  estimated_minutes: string
}

type EventFormState = {
  title: string
  event_type: 'test' | 'assignment' | 'personal' | 'other'
  event_date: string
  reminder_at: string
  notes: string
  subject: string
}

type ViewMode = 'tasks' | 'calendar'

const initialTaskFormState: TaskFormState = {
  title: '',
  reason: '',
  notes: '',
  deadline: '',
  priority: 'medium',
  estimated_minutes: '',
}

const initialEventFormState: EventFormState = {
  title: '',
  event_type: 'personal',
  event_date: '',
  reminder_at: '',
  notes: '',
  subject: '',
}

function Dashboard() {
  const { user, signOut } = useAuth()
  const [view, setView] = useState<ViewMode>('tasks')

  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasksError, setTasksError] = useState('')
  const [taskFormState, setTaskFormState] = useState<TaskFormState>(initialTaskFormState)
  const [showTaskDetails, setShowTaskDetails] = useState(false)
  const [taskSubmitting, setTaskSubmitting] = useState(false)

  const [events, setEvents] = useState<CalendarEventWithTest[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState('')
  const [eventFormState, setEventFormState] = useState<EventFormState>(initialEventFormState)
  const [eventSubmitting, setEventSubmitting] = useState(false)

  const fetchTasks = async () => {
    if (!user?.id) return

    setTasksLoading(true)
    setTasksError('')

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setTasksLoading(false)

    if (error) {
      setTasksError(`The task list could not be loaded: ${error.message}. Please try again.`)
      return
    }

    setTasks((data ?? []) as Task[])
  }

  const fetchEvents = async () => {
    if (!user?.id) return

    setEventsLoading(true)
    setEventsError('')

    const { data: eventsData, error: eventsErrorData } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .order('event_date', { ascending: true })

    setEventsLoading(false)

    if (eventsErrorData) {
      setEventsError(`The calendar could not be loaded: ${eventsErrorData.message}. Please try again.`)
      return
    }

    const { data: testsData, error: testsErrorData } = await supabase
      .from('tests')
      .select('*')
      .eq('user_id', user.id)

    if (testsErrorData) {
      setEventsError(`The calendar could not be loaded: ${testsErrorData.message}. Please try again.`)
      return
    }

    const testLookup = new Map<string, TestRow>()
    ;(testsData ?? []).forEach((test: TestRow) => {
      testLookup.set(test.calendar_event_id, test)
    })

    setEvents(
      (eventsData ?? []).map((event) => ({
        ...(event as CalendarEvent),
        test: testLookup.get((event as CalendarEvent).id) ?? null,
      })) as CalendarEventWithTest[],
    )
  }

  useEffect(() => {
    fetchTasks()
    fetchEvents()
  }, [user?.id])

  const handleTaskSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user?.id || !taskFormState.title.trim()) return

    setTaskSubmitting(true)
    setTasksError('')

    const payload = {
      user_id: user.id,
      title: taskFormState.title.trim(),
      reason: taskFormState.reason.trim() || null,
      notes: taskFormState.notes.trim() || null,
      deadline: taskFormState.deadline ? new Date(taskFormState.deadline).toISOString() : null,
      priority: taskFormState.priority,
      estimated_minutes: taskFormState.estimated_minutes ? Number(taskFormState.estimated_minutes) : null,
      completed: false,
    }

    const { error } = await supabase.from('tasks').insert(payload)
    setTaskSubmitting(false)

    if (error) {
      setTasksError(`The task could not be saved: ${error.message}. Please try again.`)
      return
    }

    setTaskFormState(initialTaskFormState)
    setShowTaskDetails(false)
    fetchTasks()
  }

  const toggleTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase.from('tasks').update({ completed: !completed }).eq('id', taskId)

    if (error) {
      setTasksError(`The task status could not be updated: ${error.message}. Please try again.`)
      return
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, completed: !completed } : task)),
    )
  }

  const handleEventSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user?.id) return
    if (!eventFormState.title.trim()) {
      setEventsError('Please give the event a title before saving it.')
      return
    }
    if (eventFormState.event_type === 'test' && !eventFormState.subject.trim()) {
      setEventsError('Please add a subject for the test before saving it.')
      return
    }
    if (!eventFormState.event_date) {
      setEventsError('Please choose an event date before saving it.')
      return
    }

    setEventSubmitting(true)
    setEventsError('')

    const eventPayload = {
      user_id: user.id,
      title: eventFormState.title.trim(),
      event_type: eventFormState.event_type,
      event_date: new Date(eventFormState.event_date).toISOString(),
      reminder_at: eventFormState.reminder_at ? new Date(eventFormState.reminder_at).toISOString() : null,
      notes: eventFormState.notes.trim() || null,
    }

    const { data: insertedEvent, error: eventError } = await supabase.from('calendar_events').insert(eventPayload).select().single()
    setEventSubmitting(false)

    if (eventError || !insertedEvent) {
      setEventsError(`The event could not be saved: ${eventError?.message ?? 'No event was returned.'}. Please try again.`)
      return
    }

    if (eventFormState.event_type === 'test') {
      const { error: testError } = await supabase.from('tests').insert({
        user_id: user.id,
        calendar_event_id: insertedEvent.id,
        subject: eventFormState.subject.trim(),
        preparation_status: 'not_started',
        study_progress: 0,
      })

      if (testError) {
        setEventsError(`The test was created, but the study record could not be saved: ${testError.message}. Please try again.`)
        return
      }
    }

    setEventFormState(initialEventFormState)
    fetchEvents()
  }

  const updateTestProgress = async (eventId: string, status: TestRow['preparation_status'], progress: number) => {
    const { error } = await supabase
      .from('tests')
      .update({ preparation_status: status, study_progress: progress })
      .eq('calendar_event_id', eventId)
      .eq('user_id', user?.id)

    if (error) {
      setEventsError(`The test progress could not be updated: ${error.message}. Please try again.`)
      return
    }

    setEvents((currentEvents) =>
      currentEvents.map((event) => (event.id === eventId ? { ...event, test: event.test ? { ...event.test, preparation_status: status, study_progress: progress } : null } : event)),
    )
  }

  const deleteEvent = async (eventId: string) => {
    const { error: testDeleteError } = await supabase.from('tests').delete().eq('calendar_event_id', eventId)

    if (testDeleteError) {
      setEventsError(`The test record could not be removed: ${testDeleteError.message}. Please try again.`)
      return
    }

    const { error: eventDeleteError } = await supabase.from('calendar_events').delete().eq('id', eventId)

    if (eventDeleteError) {
      setEventsError(`The event could not be removed: ${eventDeleteError.message}. Please try again.`)
      return
    }

    setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId))
  }

  const taskSummary = useMemo(() => {
    const completedCount = tasks.filter((task) => task.completed).length
    return {
      total: tasks.length,
      completed: completedCount,
    }
  }, [tasks])

  return (
    <div className="min-h-screen bg-[#754B4D] px-4 py-8 text-[#D8A694] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 border-b border-white/20 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">VEXA / {view}</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">{view === 'tasks' ? 'Task board' : 'Calendar'}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/20 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setView('tasks')}
                className={`rounded-full px-4 py-2 font-sans text-sm ${view === 'tasks' ? 'bg-[#D8A694] text-[#754B4D]' : 'text-white/80'}`}
              >
                Tasks
              </button>
              <button
                type="button"
                onClick={() => setView('calendar')}
                className={`rounded-full px-4 py-2 font-sans text-sm ${view === 'calendar' ? 'bg-[#D8A694] text-[#754B4D]' : 'text-white/80'}`}
              >
                Calendar
              </button>
            </div>

            <button
              type="button"
              onClick={() => signOut()}
              className="w-fit rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
            >
              Sign out
            </button>
          </div>
        </div>

        {view === 'tasks' ? (
          <>
            <div className="mt-6 rounded-[1.5rem] border border-white/20 bg-[#754B4D]/70 p-4 shadow-inner">
              <form className="space-y-4" onSubmit={handleTaskSubmit}>
                <input
                  value={taskFormState.title}
                  onChange={(event) => setTaskFormState((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Add a task"
                  className="w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 font-sans text-sm text-white outline-none placeholder:text-white/60 focus:border-[#D8A694] focus:ring-2 focus:ring-[#D8A694]/40"
                />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowTaskDetails((current) => !current)}
                    className="text-sm font-semibold text-[#D8A694] underline-offset-4 hover:underline"
                  >
                    {showTaskDetails ? 'Hide details' : 'Add details'}
                  </button>
                  <button
                    type="submit"
                    disabled={taskSubmitting || !taskFormState.title.trim()}
                    className="rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {taskSubmitting ? 'Saving…' : 'Save task'}
                  </button>
                </div>

                {showTaskDetails ? (
                  <div className="grid gap-4 rounded-[1.25rem] border border-white/20 bg-white/10 p-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block font-sans text-sm text-[#D8A694]">Deadline</label>
                      <input
                        type="date"
                        value={taskFormState.deadline}
                        onChange={(event) => setTaskFormState((current) => ({ ...current, deadline: event.target.value }))}
                        className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block font-sans text-sm text-[#D8A694]">Priority</label>
                      <select
                        value={taskFormState.priority}
                        onChange={(event) => setTaskFormState((current) => ({ ...current, priority: event.target.value as TaskFormState['priority'] }))}
                        className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                      >
                        <option value="low" className="text-[#754B4D]">Low</option>
                        <option value="medium" className="text-[#754B4D]">Medium</option>
                        <option value="high" className="text-[#754B4D]">High</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block font-sans text-sm text-[#D8A694]">Estimated minutes</label>
                      <input
                        type="number"
                        min="1"
                        value={taskFormState.estimated_minutes}
                        onChange={(event) => setTaskFormState((current) => ({ ...current, estimated_minutes: event.target.value }))}
                        className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block font-sans text-sm text-[#D8A694]">Why this matters</label>
                      <input
                        value={taskFormState.reason}
                        onChange={(event) => setTaskFormState((current) => ({ ...current, reason: event.target.value }))}
                        className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block font-sans text-sm text-[#D8A694]">Notes</label>
                      <textarea
                        value={taskFormState.notes}
                        onChange={(event) => setTaskFormState((current) => ({ ...current, notes: event.target.value }))}
                        rows={3}
                        className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                      />
                    </div>
                  </div>
                ) : null}
              </form>
            </div>

            <div className="mt-6 flex items-center justify-between text-sm text-white/80">
              <p>{taskSummary.total} tracked</p>
              <p>{taskSummary.completed} complete</p>
            </div>

            {tasksError ? (
              <div className="mt-4 rounded-2xl border border-[#D8A694]/30 bg-[#A86A65]/40 px-4 py-3 font-sans text-sm text-white">
                {tasksError}
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {tasksLoading ? (
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 font-sans text-sm text-white/80">
                  Loading your tasks…
                </div>
              ) : null}

              {!tasksLoading && tasks.length === 0 ? (
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-6 font-mono text-sm text-[#D8A694]">
                  <div>&gt; scanning_task_database... 0 tasks detected.</div>
                  <div>&gt; awaiting_input_</div>
                </div>
              ) : null}

              {!tasksLoading && tasks.length > 0
                ? tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`rounded-[1.25rem] border border-white/20 bg-white/10 p-4 transition ${task.completed ? 'opacity-60' : 'opacity-100'}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleTask(task.id, task.completed)}
                          className={`mt-1 h-5 w-5 flex-shrink-0 rounded border ${task.completed ? 'border-[#D8A694] bg-[#D8A694]' : 'border-white/40 bg-transparent'}`}
                          aria-label={`Toggle ${task.title}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className={`font-sans text-base font-semibold ${task.completed ? 'line-through text-white/70' : 'text-white'}`}>
                              {task.title}
                            </h2>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] ${priorityClasses(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>

                          {(task.deadline || task.reason || task.notes || task.estimated_minutes) && (
                            <div className="mt-2 space-y-1 font-sans text-sm text-white/75">
                              {task.deadline ? <p>Due {formatDate(task.deadline)}</p> : null}
                              {task.reason ? <p>{task.reason}</p> : null}
                              {task.notes ? <p>{task.notes}</p> : null}
                              {task.estimated_minutes ? <p>{task.estimated_minutes} min estimate</p> : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                : null}
            </div>
          </>
        ) : (
          <>
            <div className="mt-6 rounded-[1.5rem] border border-white/20 bg-[#754B4D]/70 p-4 shadow-inner">
              <form className="space-y-4" onSubmit={handleEventSubmit}>
                <input
                  value={eventFormState.title}
                  onChange={(event) => setEventFormState((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Add an event"
                  className="w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 font-sans text-sm text-white outline-none placeholder:text-white/60 focus:border-[#D8A694] focus:ring-2 focus:ring-[#D8A694]/40"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-sans text-sm text-[#D8A694]">Type</label>
                    <select
                      value={eventFormState.event_type}
                      onChange={(event) => setEventFormState((current) => ({ ...current, event_type: event.target.value as EventFormState['event_type'] }))}
                      className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                    >
                      <option value="test" className="text-[#754B4D]">Test</option>
                      <option value="assignment" className="text-[#754B4D]">Assignment</option>
                      <option value="personal" className="text-[#754B4D]">Personal</option>
                      <option value="other" className="text-[#754B4D]">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block font-sans text-sm text-[#D8A694]">Event date</label>
                    <input
                      type="datetime-local"
                      value={eventFormState.event_date}
                      onChange={(event) => setEventFormState((current) => ({ ...current, event_date: event.target.value }))}
                      className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-sans text-sm text-[#D8A694]">Reminder</label>
                    <input
                      type="datetime-local"
                      value={eventFormState.reminder_at}
                      onChange={(event) => setEventFormState((current) => ({ ...current, reminder_at: event.target.value }))}
                      className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-sans text-sm text-[#D8A694]">Subject</label>
                    <input
                      value={eventFormState.subject}
                      onChange={(event) => setEventFormState((current) => ({ ...current, subject: event.target.value }))}
                      placeholder={eventFormState.event_type === 'test' ? 'Math, English, etc.' : 'Optional'}
                      className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-sans text-sm text-[#D8A694]">Notes</label>
                  <textarea
                    value={eventFormState.notes}
                    onChange={(event) => setEventFormState((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={eventSubmitting || !eventFormState.title.trim() || (eventFormState.event_type === 'test' && !eventFormState.subject.trim()) || !eventFormState.event_date}
                    className="rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {eventSubmitting ? 'Saving…' : 'Save event'}
                  </button>
                </div>
              </form>
            </div>

            {eventsError ? (
              <div className="mt-4 rounded-2xl border border-[#D8A694]/30 bg-[#A86A65]/40 px-4 py-3 font-sans text-sm text-white">
                {eventsError}
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {eventsLoading ? (
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 font-sans text-sm text-white/80">
                  Loading your calendar…
                </div>
              ) : null}

              {!eventsLoading && events.length === 0 ? (
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-6 font-mono text-sm text-[#D8A694]">
                  <div>&gt; scanning_calendar... 0 events detected.</div>
                  <div>&gt; awaiting_input_</div>
                </div>
              ) : null}

              {!eventsLoading && events.length > 0
                ? events.map((event) => (
                    <div key={event.id} className="rounded-[1.25rem] border border-white/20 bg-white/10 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-sans text-base font-semibold text-white">{event.title}</h2>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] ${eventTypeClasses(event.event_type)}`}>
                              {event.event_type}
                            </span>
                          </div>

                          <p className="mt-2 font-sans text-sm text-white/80">{formatDateTime(event.event_date)}</p>
                          {event.notes ? <p className="mt-2 font-sans text-sm text-white/70">{event.notes}</p> : null}

                          {event.test ? (
                            <div className="mt-4 rounded-2xl border border-white/20 bg-[#754B4D]/60 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-sans text-sm text-[#D8A694]">Subject</p>
                                  <p className="font-sans text-sm text-white">{event.test.subject}</p>
                                </div>
                                <div className="w-full sm:w-auto">
                                  <label className="mb-2 block font-sans text-xs uppercase tracking-[0.2em] text-[#D8A694]">Status</label>
                                  <select
                                    value={event.test.preparation_status}
                                    onChange={(changeEvent) => updateTestProgress(event.id, changeEvent.target.value as TestRow['preparation_status'], event.test?.study_progress ?? 0)}
                                    className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                                  >
                                    <option value="not_started" className="text-[#754B4D]">Not started</option>
                                    <option value="in_progress" className="text-[#754B4D]">In progress</option>
                                    <option value="ready" className="text-[#754B4D]">Ready</option>
                                  </select>
                                </div>
                              </div>

                              <div className="mt-3">
                                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#D8A694]">
                                  <span>Study progress</span>
                                  <span>{event.test.study_progress}%</span>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-white/10">
                                  <div className="h-2 rounded-full bg-[#D8A694]" style={{ width: `${event.test.study_progress}%` }} />
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={event.test.study_progress}
                                  onChange={(changeEvent) => updateTestProgress(event.id, event.test?.preparation_status ?? 'not_started', Number(changeEvent.target.value))}
                                  className="mt-3 w-full accent-[#D8A694]"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteEvent(event.id)}
                          className="rounded-2xl border border-white/30 bg-white/20 px-3 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function priorityClasses(priority: Task['priority']) {
  switch (priority) {
    case 'high':
      return 'border-[#A86A65] bg-[#A86A65]/20 text-[#D8A694]'
    case 'low':
      return 'border-[#AB8882] bg-[#AB8882]/20 text-[#D8A694]'
    default:
      return 'border-[#D8A694]/50 bg-white/10 text-[#D8A694]'
  }
}

function eventTypeClasses(eventType: CalendarEvent['event_type']) {
  switch (eventType) {
    case 'test':
      return 'border-[#A86A65] bg-[#A86A65]/20 text-[#D8A694]'
    case 'assignment':
      return 'border-[#AB8882] bg-[#AB8882]/20 text-[#D8A694]'
    case 'personal':
      return 'border-[#D8A694]/50 bg-white/10 text-[#D8A694]'
    default:
      return 'border-white/20 bg-white/10 text-white'
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default Dashboard
