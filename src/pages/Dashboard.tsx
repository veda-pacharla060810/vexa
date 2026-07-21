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

type ScrollSession = {
  id: string
  user_id: string
  platform: string | null
  reason: string | null
  reflection: string | null
  was_it_worth_it: 'yes' | 'neutral' | 'no' | null
  started_at: string
  ended_at: string
  duration_minutes: number | null
  created_at: string
}

type DailyReceipt = {
  id: string
  user_id: string
  receipt_date: string
  focus_time_minutes: number
  scroll_time_minutes: number
  tasks_completed_count: number
  biggest_win: string | null
  biggest_distraction: string | null
  ai_summary: string | null
  tomorrow_priority: string | null
  created_at: string
}

type ViewMode = 'tasks' | 'calendar' | 'focus' | 'scroll' | 'receipt'

const focusQuotes = [
  'One task. Right now. That\'s it.',
  'You do not need to feel ready. You only need to begin.',
  'The next five minutes count.',
  'No drama. Just one honest block.',
  'Let the page be enough for now.',
  'A quiet start still moves you forward.',
  'You can be tired and still keep going.',
  'Clear the noise. Stay with this.',
  'Small focus beats forced motivation.',
  'This is the part where you stop scrolling.',
  'One breath. One paragraph. One problem.',
  'You are allowed to do the boring thing well.',
]

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
  const [focusActive, setFocusActive] = useState(false)
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null)
  const [focusTaskId, setFocusTaskId] = useState('')
  const [focusTimeSeconds, setFocusTimeSeconds] = useState(25 * 60)
  const [focusElapsedSeconds, setFocusElapsedSeconds] = useState(0)
  const [focusIsPaused, setFocusIsPaused] = useState(false)
  const [focusLoading, setFocusLoading] = useState(false)
  const [focusError, setFocusError] = useState('')
  const [focusCompleteRequested, setFocusCompleteRequested] = useState(false)
  const [focusQuote, setFocusQuote] = useState(focusQuotes[0])
  const [scrollPlatform, setScrollPlatform] = useState('')
  const [scrollReason, setScrollReason] = useState('')
  const [scrollActive, setScrollActive] = useState(false)
  const [scrollReviewing, setScrollReviewing] = useState(false)
  const [scrollStartedAt, setScrollStartedAt] = useState<string | null>(null)
  const [scrollElapsedSeconds, setScrollElapsedSeconds] = useState(0)
  const [scrollReflection, setScrollReflection] = useState('')
  const [scrollWorthIt, setScrollWorthIt] = useState<'yes' | 'neutral' | 'no' | null>(null)
  const [scrollSessions, setScrollSessions] = useState<ScrollSession[]>([])
  const [scrollLoading, setScrollLoading] = useState(true)
  const [scrollError, setScrollError] = useState('')
  const [scrollSubmitting, setScrollSubmitting] = useState(false)
  const [receiptBiggestWin, setReceiptBiggestWin] = useState('')
  const [receiptBiggestDistraction, setReceiptBiggestDistraction] = useState('')
  const [receiptTomorrowPriority, setReceiptTomorrowPriority] = useState('')
  const [receiptGenerating, setReceiptGenerating] = useState(false)
  const [receiptError, setReceiptError] = useState('')
  const [receipts, setReceipts] = useState<DailyReceipt[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()))

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

  const fetchScrollSessions = async () => {
    if (!user?.id) return

    setScrollLoading(true)
    setScrollError('')

    const { data, error } = await supabase
      .from('scroll_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })

    setScrollLoading(false)

    if (error) {
      setScrollError(`The scroll history could not be loaded: ${error.message}. Please try again.`)
      return
    }

    setScrollSessions((data ?? []) as ScrollSession[])
  }

  const fetchReceipts = async () => {
    if (!user?.id) return

    setReceiptsLoading(true)
    setReceiptError('')

    const { data, error } = await supabase
      .from('daily_receipts')
      .select('*')
      .eq('user_id', user.id)
      .order('receipt_date', { ascending: false })

    setReceiptsLoading(false)

    if (error) {
      setReceiptError(`The receipts history could not be loaded: ${error.message}. Please try again.`)
      return
    }

    setReceipts((data ?? []) as DailyReceipt[])
  }

  useEffect(() => {
    void fetchTasks()
    void fetchEvents()
    void fetchScrollSessions()
    void fetchReceipts()
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

  const focusTaskOptions = useMemo(() => tasks.filter((task) => !task.completed), [tasks])
  const selectedFocusTask = focusTaskOptions.find((task) => task.id === focusTaskId) ?? null

  const calendarDays = useMemo(() => getMonthGrid(calendarMonth), [calendarMonth])

  const selectedDayKey = selectedDate ?? formatDateKey(new Date())
  const selectedDay = new Date(`${selectedDayKey}T00:00:00`)
  const selectedDayIsPast = startOfDay(selectedDay) < startOfDay(new Date())

  const selectedDayEvents = useMemo(() => {
    const targetDate = selectedDayKey
    return events.filter((event) => formatDateKey(event.event_date) === targetDate)
  }, [events, selectedDayKey])

  const selectedDayTaskItems = useMemo(() => {
    const targetDate = selectedDayKey
    return tasks.filter((task) => {
      const deadlineMatches = task.deadline ? formatDateKey(task.deadline) === targetDate : false
      const completedMatches = task.completed && task.created_at ? formatDateKey(task.created_at) === targetDate : false
      return deadlineMatches || completedMatches
    })
  }, [tasks, selectedDayKey])

  const handleDaySelect = (date: Date) => {
    const nextKey = formatDateKey(date)
    setSelectedDate(nextKey)
    setEventFormState((current) => ({
      ...current,
      event_date: toDateTimeInputValue(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)),
    }))
  }

  const resetEventForm = () => {
    setEventFormState({
      ...initialEventFormState,
      event_date: selectedDate ? toDateTimeInputValue(new Date(`${selectedDate}T09:00`)) : '',
    })
  }

  const startFocusSession = async () => {
    if (!user?.id) return

    setFocusError('')
    setFocusLoading(true)

    const startedAt = new Date().toISOString()
    const { data: newSession, error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id: user.id,
        task_id: focusTaskId || null,
        started_at: startedAt,
      })
      .select()
      .single()

    setFocusLoading(false)

    if (error || !newSession) {
      setFocusError(`The focus session could not be started: ${error?.message ?? 'No session returned.'}. Please try again.`)
      return
    }

    const nextQuote = focusQuotes[Math.floor(Math.random() * focusQuotes.length)]

    setFocusSessionId(newSession.id)
    setFocusActive(true)
    setFocusIsPaused(false)
    setFocusTimeSeconds(25 * 60)
    setFocusQuote(nextQuote)
    setFocusElapsedSeconds(0)
    setFocusCompleteRequested(false)
    setView('focus')
  }

  const startScrollSession = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!user?.id) return

    setScrollError('')
    setScrollActive(true)
    setScrollReviewing(false)
    setScrollStartedAt(new Date().toISOString())
    setScrollElapsedSeconds(0)
    setScrollReflection('')
    setScrollWorthIt(null)
    setView('scroll')
  }

  const stopScrollSession = () => {
    if (!scrollStartedAt) return

    setScrollReviewing(true)
  }

  const saveScrollSession = async () => {
    if (!user?.id || !scrollStartedAt) return
    if (!scrollWorthIt) {
      setScrollError('Choose whether the scroll was worth it before saving.')
      return
    }

    setScrollSubmitting(true)
    setScrollError('')

    const endedAt = new Date().toISOString()
    const durationMinutes = Math.max(1, Math.round(scrollElapsedSeconds / 60))

    const payload = {
      user_id: user.id,
      platform: scrollPlatform.trim() || null,
      reason: scrollReason.trim() || null,
      reflection: scrollReflection.trim() || null,
      was_it_worth_it: scrollWorthIt,
      started_at: scrollStartedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      created_at: endedAt,
    }

    const { data, error } = await supabase.from('scroll_sessions').insert(payload).select().single()
    setScrollSubmitting(false)

    if (error || !data) {
      setScrollError(`The scroll session could not be saved: ${error?.message ?? 'No session returned.'}. Please try again.`)
      return
    }

    setScrollSessions((currentSessions) => [data as ScrollSession, ...currentSessions])
    setScrollActive(false)
    setScrollReviewing(false)
    setScrollStartedAt(null)
    setScrollElapsedSeconds(0)
    setScrollReflection('')
    setScrollWorthIt(null)
    setScrollPlatform('')
    setScrollReason('')
  }

  const generateReceipt = async () => {
    if (!user?.id) return

    setReceiptGenerating(true)
    setReceiptError('')

    const todayKey = formatDateKey(new Date())

    const { data: todayTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, completed, created_at')
      .eq('user_id', user.id)

    if (tasksError) {
      setReceiptGenerating(false)
      setReceiptError(`The receipt could not be generated: ${tasksError.message}. Please try again.`)
      return
    }

    const todayTaskEntries = (todayTasks ?? []).filter((task) => {
      const createdAtKey = formatDateKey(task.created_at)
      return createdAtKey === todayKey
    })

    const completedTodayCount = todayTaskEntries.filter((task) => task.completed).length

    const { data: focusRows, error: focusError } = await supabase
      .from('focus_sessions')
      .select('duration_minutes, started_at')
      .eq('user_id', user.id)

    if (focusError) {
      setReceiptGenerating(false)
      setReceiptError(`The receipt could not be generated: ${focusError.message}. Please try again.`)
      return
    }

    const { data: scrollRows, error: scrollError } = await supabase
      .from('scroll_sessions')
      .select('duration_minutes, started_at')
      .eq('user_id', user.id)

    if (scrollError) {
      setReceiptGenerating(false)
      setReceiptError(`The receipt could not be generated: ${scrollError.message}. Please try again.`)
      return
    }

    const focusTimeMinutes = (focusRows ?? [])
      .filter((row) => formatDateKey(row.started_at) === todayKey)
      .reduce((total, row) => total + (row.duration_minutes ?? 0), 0)

    const scrollTimeMinutes = (scrollRows ?? [])
      .filter((row) => formatDateKey(row.started_at) === todayKey)
      .reduce((total, row) => total + (row.duration_minutes ?? 0), 0)

    const summaryParts = []
    if (focusTimeMinutes > scrollTimeMinutes) {
      summaryParts.push('You spent more time on focus than scrolling today.')
    } else if (scrollTimeMinutes > focusTimeMinutes) {
      summaryParts.push('Your scroll time edged out focus today, so a lighter reset might help tomorrow.')
    } else {
      summaryParts.push('Your day stayed balanced between focus and scrolling.')
    }

    if (completedTodayCount >= 2) {
      summaryParts.push('You completed enough work to keep the momentum going.')
    } else {
      summaryParts.push('A small win would make tomorrow feel easier.')
    }

    // TODO: replace with real Claude-generated summary once AI Command Center is built.
    const aiSummary = summaryParts.join(' ')

    const payload = {
      user_id: user.id,
      receipt_date: todayKey,
      focus_time_minutes: focusTimeMinutes,
      scroll_time_minutes: scrollTimeMinutes,
      tasks_completed_count: completedTodayCount,
      biggest_win: receiptBiggestWin.trim() || null,
      biggest_distraction: receiptBiggestDistraction.trim() || null,
      ai_summary: aiSummary,
      tomorrow_priority: receiptTomorrowPriority.trim() || null,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from('daily_receipts').upsert(payload, { onConflict: 'user_id,receipt_date' }).select().single()
    setReceiptGenerating(false)

    if (error || !data) {
      setReceiptError(`The receipt could not be saved: ${error?.message ?? 'No receipt returned.'}. Please try again.`)
      return
    }

    setReceipts((currentReceipts) => {
      const nextReceipts = currentReceipts.filter((receipt) => receipt.receipt_date !== todayKey)
      return [data as DailyReceipt, ...nextReceipts]
    })

    setReceiptBiggestWin('')
    setReceiptBiggestDistraction('')
    setReceiptTomorrowPriority('')
  }

  const completeFocusSession = async () => {
    if (!user?.id || !focusSessionId) {
      setFocusActive(false)
      setFocusIsPaused(false)
      setFocusTimeSeconds(25 * 60)
      setFocusElapsedSeconds(0)
      setFocusSessionId(null)
      setFocusCompleteRequested(false)
      setView('tasks')
      return
    }

    const durationMinutes = Math.max(1, Math.round(focusElapsedSeconds / 60))
    const endedAt = new Date().toISOString()

    const { error: sessionError } = await supabase
      .from('focus_sessions')
      .update({ ended_at: endedAt, duration_minutes: durationMinutes })
      .eq('id', focusSessionId)
      .eq('user_id', user.id)

    if (sessionError) {
      setFocusError(`The focus session could not be completed: ${sessionError.message}. Please try again.`)
      return
    }

    if (focusTaskId) {
      const { data: taskRow, error: taskLookupError } = await supabase
        .from('tasks')
        .select('actual_focus_minutes')
        .eq('id', focusTaskId)
        .single()

      if (!taskLookupError && taskRow) {
        const nextMinutes = (taskRow.actual_focus_minutes ?? 0) + durationMinutes
        const { error: taskUpdateError } = await supabase.from('tasks').update({ actual_focus_minutes: nextMinutes }).eq('id', focusTaskId)

        if (!taskUpdateError) {
          setTasks((currentTasks) => currentTasks.map((task) => (task.id === focusTaskId ? { ...task, actual_focus_minutes: nextMinutes } : task)))
        }
      }
    }

    setFocusActive(false)
    setFocusIsPaused(false)
    setFocusTimeSeconds(25 * 60)
    setFocusElapsedSeconds(0)
    setFocusSessionId(null)
    setFocusCompleteRequested(false)
    setView('tasks')
  }

  useEffect(() => {
    if (!focusActive || focusIsPaused) return

    const intervalId = window.setInterval(() => {
      setFocusTimeSeconds((current) => current - 1)
      setFocusElapsedSeconds((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [focusActive, focusIsPaused])

  useEffect(() => {
    if (!focusActive || focusTimeSeconds > 0 || focusCompleteRequested) return

    setFocusCompleteRequested(true)
    void completeFocusSession()
  }, [focusActive, focusTimeSeconds, focusCompleteRequested])

  useEffect(() => {
    if (!focusActive) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [focusActive])

  useEffect(() => {
    if (focusTaskId && !focusTaskOptions.some((task) => task.id === focusTaskId)) {
      setFocusTaskId('')
    }
  }, [focusTaskId, focusTaskOptions])

  useEffect(() => {
    if (!scrollActive || scrollReviewing) return

    const intervalId = window.setInterval(() => {
      setScrollElapsedSeconds((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [scrollActive, scrollReviewing])

  if (focusActive) {
    return (
      <div className="min-h-screen bg-[#754B4D] px-4 py-8 text-[#D8A694] sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col items-center justify-center rounded-[2rem] border border-white/20 bg-[#754B4D]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/20 bg-white/10 p-8 text-center shadow-inner">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#D8A694]/70">&gt; focus_mode.exe</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.4em] text-[#D8A694]/70">&gt; distractions paused</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.4em] text-[#D8A694]/70">&gt; timer initialized</p>

            <div className="mt-8 rounded-[1.5rem] border border-white/20 bg-[#754B4D]/70 p-6 shadow-inner">
              <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#D8A694]/70">Current task</p>
              <h2 className="mt-2 font-serif text-3xl text-white">{selectedFocusTask ? selectedFocusTask.title : 'General focus'}</h2>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">{focusIsPaused ? 'paused' : 'in flow'}</p>
              <div className="mt-6 font-serif text-7xl font-semibold tracking-[0.2em] text-white sm:text-8xl">
                {formatCountdown(focusTimeSeconds)}
              </div>
            </div>

            <p className="mt-6 max-w-xl font-hand text-xl leading-relaxed text-[#D8A694]/90 sm:text-2xl">
              {focusQuote}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setFocusIsPaused((current) => !current)}
                className="rounded-2xl border border-white/30 bg-white/20 px-5 py-3 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
              >
                {focusIsPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={() => void completeFocusSession()}
                className="rounded-2xl border border-[#D8A694]/40 bg-[#D8A694]/20 px-5 py-3 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-[#D8A694]/30"
              >
                Complete
              </button>
            </div>

            {focusError ? (
              <div className="mt-6 rounded-2xl border border-[#D8A694]/30 bg-[#A86A65]/40 px-4 py-3 font-sans text-sm text-white">
                {focusError}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (!focusActive || focusIsPaused) return

    const intervalId = window.setInterval(() => {
      setFocusTimeSeconds((current) => current - 1)
      setFocusElapsedSeconds((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [focusActive, focusIsPaused])

  useEffect(() => {
    if (!scrollActive || scrollReviewing) return

    const intervalId = window.setInterval(() => {
      setScrollElapsedSeconds((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [scrollActive, scrollReviewing])

  useEffect(() => {
    if (!focusActive || focusTimeSeconds > 0 || focusCompleteRequested) return

    setFocusCompleteRequested(true)
    void completeFocusSession()
  }, [focusActive, focusTimeSeconds, focusCompleteRequested])

  useEffect(() => {
    if (!focusActive) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [focusActive])

  useEffect(() => {
    if (focusTaskId && !focusTaskOptions.some((task) => task.id === focusTaskId)) {
      setFocusTaskId('')
    }
  }, [focusTaskId, focusTaskOptions])

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
              <button
                type="button"
                onClick={() => setView('focus')}
                className={`rounded-full px-4 py-2 font-sans text-sm ${view === 'focus' ? 'bg-[#D8A694] text-[#754B4D]' : 'text-white/80'}`}
              >
                Focus
              </button>
              <button
                type="button"
                onClick={() => setView('scroll')}
                className={`rounded-full px-4 py-2 font-sans text-sm ${view === 'scroll' ? 'bg-[#D8A694] text-[#754B4D]' : 'text-white/80'}`}
              >
                Scroll
              </button>
              <button
                type="button"
                onClick={() => setView('receipt')}
                className={`rounded-full px-4 py-2 font-sans text-sm ${view === 'receipt' ? 'bg-[#D8A694] text-[#754B4D]' : 'text-white/80'}`}
              >
                Receipt
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

        {view === 'focus' ? (
          <div className="mt-6 rounded-[1.5rem] border border-white/20 bg-[#754B4D]/70 p-4 shadow-inner">
            <div className="rounded-[1.25rem] border border-white/20 bg-white/10 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">&gt; enter_focus_mode</p>
              <h2 className="mt-3 font-serif text-2xl text-white">Ready for a distraction-free session?</h2>
              <p className="mt-2 font-sans text-sm text-white/80">Pick a task to anchor your attention, or choose general focus for a free-flow block.</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className="mb-2 block font-sans text-sm text-[#D8A694]">Focus target</label>
                  <select
                    value={focusTaskId}
                    onChange={(event) => setFocusTaskId(event.target.value)}
                    className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                  >
                    <option value="" className="text-[#754B4D]">No task selected</option>
                    {focusTaskOptions.map((task) => (
                      <option key={task.id} value={task.id} className="text-[#754B4D]">
                        {task.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => void startFocusSession()}
                  disabled={focusLoading}
                  className="rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {focusLoading ? 'Starting…' : 'Start focus'}
                </button>
              </div>

              {focusError ? (
                <div className="mt-4 rounded-2xl border border-[#D8A694]/30 bg-[#A86A65]/40 px-4 py-3 font-sans text-sm text-white">
                  {focusError}
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-white/20 bg-[#754B4D]/60 p-4 font-sans text-sm text-white/75">
                <p>Default length: 25 minutes.</p>
                <p className="mt-1">This pass keeps the timer simple and distraction-free, with pause and completion controls built in.</p>
              </div>
            </div>
          </div>
        ) : view === 'scroll' ? (
          <div className="mt-6 rounded-[1.5rem] border border-white/20 bg-[#754B4D]/70 p-4 shadow-inner">
            <div className="rounded-[1.25rem] border border-white/20 bg-white/10 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">&gt; scroll_tracker</p>
              <h2 className="mt-3 font-serif text-2xl text-white">Scroll tracking for the late-night spiral.</h2>
              <p className="mt-2 font-sans text-sm text-white/80">Start a scroll session when you want to notice what you are reaching for, then save how it felt after.</p>

              {!scrollActive ? (
                <form className="mt-6 space-y-4" onSubmit={(event) => void startScrollSession(event)}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block font-sans text-sm text-[#D8A694]">Platform</label>
                      <input
                        value={scrollPlatform}
                        onChange={(event) => setScrollPlatform(event.target.value)}
                        placeholder="TikTok, Instagram, YouTube..."
                        className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none placeholder:text-white/60 focus:border-[#D8A694]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block font-sans text-sm text-[#D8A694]">Reason</label>
                      <input
                        value={scrollReason}
                        onChange={(event) => setScrollReason(event.target.value)}
                        placeholder="Why did you open it?"
                        className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none placeholder:text-white/60 focus:border-[#D8A694]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
                    >
                      Start scroll
                    </button>
                  </div>
                </form>
              ) : null}

              {scrollActive && !scrollReviewing ? (
                <div className="mt-6 rounded-[1.25rem] border border-white/20 bg-[#754B4D]/60 p-5">
                  <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#D8A694]">Live session</p>
                  <div className="mt-4 font-serif text-6xl font-semibold tracking-[0.2em] text-white sm:text-7xl">
                    {formatCountdown(scrollElapsedSeconds)}
                  </div>
                  <p className="mt-4 font-sans text-sm text-white/80">You are noticing the pull, not just falling into it.</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => stopScrollSession()}
                      className="rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
                    >
                      Stop scroll
                    </button>
                  </div>
                </div>
              ) : null}

              {scrollReviewing ? (
                <div className="mt-6 rounded-[1.25rem] border border-white/20 bg-[#754B4D]/60 p-5">
                  <p className="font-sans text-sm uppercase tracking-[0.3em] text-[#D8A694]">How did it feel?</p>
                  <p className="mt-2 font-sans text-sm text-white/80">Reflection is optional. Choosing whether it was worth it is required.</p>

                  <div className="mt-4">
                    <label className="mb-2 block font-sans text-sm text-[#D8A694]">Reflection</label>
                    <textarea
                      value={scrollReflection}
                      onChange={(event) => setScrollReflection(event.target.value)}
                      rows={3}
                      placeholder="What happened? What did you notice?"
                      className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none placeholder:text-white/60 focus:border-[#D8A694]"
                    />
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 font-sans text-sm text-[#D8A694]">Was it worth it?</p>
                    <div className="flex flex-wrap gap-3">
                      {(['yes', 'neutral', 'no'] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setScrollWorthIt(value)}
                          className={`rounded-full border px-4 py-2 font-sans text-sm font-semibold capitalize transition ${scrollWorthIt === value ? 'border-[#D8A694] bg-[#D8A694]/30 text-white' : 'border-white/30 bg-white/10 text-white/80 hover:bg-white/20'}`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveScrollSession()}
                      disabled={scrollSubmitting}
                      className="rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {scrollSubmitting ? 'Saving…' : 'Save scroll log'}
                    </button>
                  </div>
                </div>
              ) : null}

              {scrollError ? (
                <div className="mt-4 rounded-2xl border border-[#D8A694]/30 bg-[#A86A65]/40 px-4 py-3 font-sans text-sm text-white">
                  {scrollError}
                </div>
              ) : null}

              <div className="mt-6 rounded-[1.25rem] border border-white/20 bg-[#754B4D]/60 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">scroll log</p>

                {scrollLoading ? (
                  <p className="mt-3 font-sans text-sm text-white/80">Loading your scroll history…</p>
                ) : null}

                {!scrollLoading && scrollSessions.length === 0 ? (
                  <p className="mt-3 font-mono text-sm text-[#D8A694]">&gt; scroll_log_empty. no sessions recorded_</p>
                ) : null}

                {!scrollLoading && scrollSessions.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {scrollSessions.map((session) => (
                      <div key={session.id} className="rounded-[1rem] border border-white/20 bg-white/10 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-sans text-sm font-semibold text-white">{session.platform ?? 'General scroll'}</p>
                            <p className="mt-1 font-sans text-sm text-white/70">{session.reason ?? 'No reason recorded'}</p>
                          </div>
                          <span className="rounded-full border border-[#D8A694]/40 bg-[#D8A694]/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-[#D8A694]">
                            {session.was_it_worth_it ?? 'neutral'}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 font-sans text-sm text-white/75">
                          <span>{session.duration_minutes ? `${session.duration_minutes} min` : 'timing pending'}</span>
                          <span>•</span>
                          <span>{formatDateTime(session.started_at)}</span>
                        </div>
                        {session.reflection ? <p className="mt-3 font-sans text-sm text-white/70">{session.reflection}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : view === 'receipt' ? (
          <div className="mt-6 rounded-[1.5rem] border border-white/20 bg-[#754B4D]/70 p-4 shadow-inner">
            <div className="rounded-[1.25rem] border border-white/20 bg-white/10 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">&gt; daily_receipt</p>
              <h2 className="mt-3 font-serif text-2xl text-white">Generate today's receipt</h2>
              <p className="mt-2 font-sans text-sm text-white/80">A short paper trail for your day: what moved, what pulled you off course, and what matters tomorrow.</p>

              <div className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block font-sans text-sm text-[#D8A694]">Biggest win</label>
                    <input
                      value={receiptBiggestWin}
                      onChange={(event) => setReceiptBiggestWin(event.target.value)}
                      placeholder="What felt good?"
                      className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none placeholder:text-white/60 focus:border-[#D8A694]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-sans text-sm text-[#D8A694]">Biggest distraction</label>
                    <input
                      value={receiptBiggestDistraction}
                      onChange={(event) => setReceiptBiggestDistraction(event.target.value)}
                      placeholder="What pulled you off track?"
                      className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none placeholder:text-white/60 focus:border-[#D8A694]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-sans text-sm text-[#D8A694]">Tomorrow priority</label>
                    <input
                      value={receiptTomorrowPriority}
                      onChange={(event) => setReceiptTomorrowPriority(event.target.value)}
                      placeholder="One thing to carry forward"
                      className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none placeholder:text-white/60 focus:border-[#D8A694]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void generateReceipt()}
                    disabled={receiptGenerating}
                    className="rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {receiptGenerating ? 'Generating…' : "Generate Today's Receipt"}
                  </button>
                </div>
              </div>

              {receiptError ? (
                <div className="mt-4 rounded-2xl border border-[#D8A694]/30 bg-[#A86A65]/40 px-4 py-3 font-sans text-sm text-white">
                  {receiptError}
                </div>
              ) : null}

              <div className="mt-6 rounded-[1.25rem] border border-white/20 bg-[#754B4D]/60 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">receipt preview</p>

                {receiptsLoading ? (
                  <p className="mt-3 font-sans text-sm text-white/80">Loading your receipts…</p>
                ) : null}

                {!receiptsLoading && receipts.length === 0 ? (
                  <p className="mt-3 font-mono text-sm text-[#D8A694]">&gt; no receipts generated yet_</p>
                ) : null}

                {!receiptsLoading && receipts.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {receipts.map((receipt) => (
                      <details key={receipt.id} className="rounded-[1rem] border border-white/20 bg-white/10 p-4">
                        <summary className="cursor-pointer font-sans text-sm font-semibold text-white">
                          {receipt.receipt_date} · {receipt.focus_time_minutes}m focus
                        </summary>
                        <div className="mt-4 rounded-[1rem] border border-white/20 bg-[#754B4D]/60 p-4">
                          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#D8A694]/70">VEXA DAILY RECEIPT</p>
                          <div className="mt-3 space-y-1 font-mono text-sm text-[#D8A694]">
                            <p>Tasks: {receipt.tasks_completed_count} completed</p>
                            <p>Focus: {Math.floor(receipt.focus_time_minutes / 60)}h {receipt.focus_time_minutes % 60}m</p>
                            <p>Scroll: {receipt.scroll_time_minutes}m</p>
                          </div>
                          <div className="mt-4 space-y-2 font-sans text-sm text-white/80">
                            {receipt.biggest_win ? <p><span className="text-[#D8A694]">Biggest win:</span> {receipt.biggest_win}</p> : null}
                            {receipt.biggest_distraction ? <p><span className="text-[#D8A694]">Biggest distraction:</span> {receipt.biggest_distraction}</p> : null}
                            {receipt.tomorrow_priority ? <p><span className="text-[#D8A694]">Tomorrow priority:</span> {receipt.tomorrow_priority}</p> : null}
                            {receipt.ai_summary ? <p className="mt-3 text-white/90">{receipt.ai_summary}</p> : null}
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : view === 'tasks' ? (
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">month view</p>
                  <h2 className="mt-2 font-serif text-2xl text-white">{formatMonthYear(calendarMonth)}</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    className="rounded-2xl border border-white/30 bg-white/20 px-3 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date()
                      setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                      setSelectedDate(formatDateKey(today))
                      setEventFormState({
                        ...initialEventFormState,
                        event_date: toDateTimeInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0)),
                      })
                    }}
                    className="rounded-2xl border border-white/30 bg-white/20 px-3 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    className="rounded-2xl border border-white/30 bg-white/20 px-3 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#D8A694]/80">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayLabel) => (
                  <div key={dayLabel}>{dayLabel}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const dayKey = formatDateKey(day.date)
                  const dayEvents = events.filter((event) => formatDateKey(event.event_date) === dayKey)
                  const hasTaskDeadline = tasks.some((task) => (task.deadline ? formatDateKey(task.deadline) === dayKey : false))
                  const hasCompletedTask = tasks.some((task) => (task.completed && task.created_at ? formatDateKey(task.created_at) === dayKey : false))
                  const eventTypesPresent = Array.from(new Set(dayEvents.map((event) => event.event_type)))
                  const isSelected = dayKey === selectedDayKey

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => handleDaySelect(day.date)}
                      className={`flex min-h-[88px] flex-col items-start rounded-[1rem] border p-2 text-left transition ${day.isCurrentMonth ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-white/60'} ${isSelected ? 'ring-2 ring-[#D8A694]' : ''} ${day.isToday ? 'bg-[#D8A694]/20' : ''}`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className={`text-sm font-semibold ${day.isToday ? 'text-[#D8A694]' : ''}`}>{day.date.getDate()}</span>
                        {day.isToday ? <span className="rounded-full border border-[#D8A694]/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#D8A694]">today</span> : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {eventTypesPresent.slice(0, 3).map((eventType) => (
                          <span key={`${dayKey}-${eventType}`} className={`h-2.5 w-2.5 rounded-full border border-white/20 ${eventTypeMarkerClasses(eventType)}`} />
                        ))}
                        {hasTaskDeadline ? <span className="rounded-full border border-[#AB8882]/30 bg-[#AB8882]/20 px-1.5 py-0.5 text-[10px] text-[#D8A694]">D</span> : null}
                        {hasCompletedTask ? <span className="rounded-full border border-[#D8A694]/30 bg-[#D8A694]/20 px-1.5 py-0.5 text-[10px] text-[#D8A694]">✓</span> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/20 bg-[#754B4D]/70 p-4 shadow-inner">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">day panel</p>
                  <h3 className="mt-2 font-serif text-xl text-white">{formatLongDate(selectedDayKey)}</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${selectedDayIsPast ? 'border-[#AB8882]/40 bg-[#AB8882]/20 text-[#D8A694]' : 'border-[#D8A694]/40 bg-[#D8A694]/20 text-[#D8A694]'}`}>
                  {selectedDayIsPast ? 'past day' : 'upcoming'}
                </span>
              </div>

              {eventsError ? (
                <div className="mt-4 rounded-2xl border border-[#D8A694]/30 bg-[#A86A65]/40 px-4 py-3 font-sans text-sm text-white">
                  {eventsError}
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  {eventsLoading ? (
                    <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 font-sans text-sm text-white/80">
                      Loading your calendar…
                    </div>
                  ) : null}

                  {!eventsLoading && selectedDayEvents.length === 0 && selectedDayTaskItems.length === 0 ? (
                    <div className="rounded-[1.25rem] border border-white/20 bg-white/10 px-4 py-5 font-mono text-sm text-[#D8A694]">
                      <div>&gt; no activity recorded for this day_</div>
                    </div>
                  ) : null}

                  {!eventsLoading && selectedDayEvents.length > 0
                    ? selectedDayEvents.map((event) => (
                        <div key={event.id} className="rounded-[1.25rem] border border-white/20 bg-white/10 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-sans text-base font-semibold text-white">{event.title}</h4>
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

                  {!eventsLoading && selectedDayTaskItems.length > 0
                    ? selectedDayTaskItems.map((task) => {
                        const isDeadline = task.deadline ? formatDateKey(task.deadline) === selectedDayKey : false
                        const isCompleted = task.completed && task.created_at ? formatDateKey(task.created_at) === selectedDayKey : false

                        return (
                          <div key={task.id} className="rounded-[1.25rem] border border-white/20 bg-white/10 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-sans text-base font-semibold text-white">{task.title}</h4>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] ${priorityClasses(task.priority)}`}>
                                    {isCompleted ? 'completed' : isDeadline ? 'deadline' : 'task'}
                                  </span>
                                </div>
                                {task.deadline ? <p className="mt-2 font-sans text-sm text-white/70">Deadline {formatDate(task.deadline)}</p> : null}
                                {isCompleted ? <p className="mt-2 font-sans text-sm text-white/70">Completed on this day using created_at as a best-effort proxy.</p> : null}
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] ${task.completed ? 'border-[#D8A694]/40 bg-[#D8A694]/20 text-[#D8A694]' : 'border-[#AB8882]/40 bg-[#AB8882]/20 text-[#D8A694]'}`}>
                                {task.completed ? 'done' : 'active'}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    : null}

                  <div className="rounded-[1.25rem] border border-white/20 bg-white/10 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#D8A694]/70">focus & scroll</p>
                    {/* TODO: focus_sessions and scroll_sessions data will populate here once Focus Mode and Scroll Tracker are built */}
                    <p className="mt-2 font-sans text-sm text-white/70">No focus or scroll data yet for this day.</p>
                  </div>
                </div>

                <form className="space-y-4 rounded-[1.25rem] border border-white/20 bg-white/10 p-4" onSubmit={async (event) => {
                  event.preventDefault()
                  await handleEventSubmit(event)
                  resetEventForm()
                }}>
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

function eventTypeMarkerClasses(eventType: CalendarEvent['event_type']) {
  switch (eventType) {
    case 'test':
      return 'bg-[#A86A65]'
    case 'assignment':
      return 'bg-[#AB8882]'
    case 'personal':
      return 'bg-[#D8A694]'
    default:
      return 'bg-white/80'
  }
}

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateTimeInputValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getMonthGrid(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const firstDayOffset = firstDay.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

  const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - firstDayOffset + 1
    const date = new Date(month.getFullYear(), month.getMonth(), dayNumber)
    const isCurrentMonth = date.getMonth() === month.getMonth()
    const isToday = formatDateKey(date) === formatDateKey(new Date())
    days.push({ date, isCurrentMonth, isToday })
  }

  return days.slice(0, daysInMonth + firstDayOffset + (firstDayOffset > 0 ? 0 : 7))
}

function formatMonthYear(value: Date) {
  return value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatLongDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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
