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

type TaskFormState = {
  title: string
  reason: string
  notes: string
  deadline: string
  priority: 'low' | 'medium' | 'high'
  estimated_minutes: string
}

const initialFormState: TaskFormState = {
  title: '',
  reason: '',
  notes: '',
  deadline: '',
  priority: 'medium',
  estimated_minutes: '',
}

function Dashboard() {
  const { user, signOut } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [formState, setFormState] = useState<TaskFormState>(initialFormState)
  const [showDetails, setShowDetails] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchTasks = async () => {
    if (!user?.id) return

    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setLoading(false)

    if (error) {
      setErrorMessage(`The task list could not be loaded: ${error.message}. Please try again.`)
      return
    }

    setTasks((data ?? []) as Task[])
  }

  useEffect(() => {
    fetchTasks()
  }, [user?.id])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user?.id || !formState.title.trim()) return

    setSubmitting(true)
    setErrorMessage('')

    const payload = {
      user_id: user.id,
      title: formState.title.trim(),
      reason: formState.reason.trim() || null,
      notes: formState.notes.trim() || null,
      deadline: formState.deadline ? new Date(formState.deadline).toISOString() : null,
      priority: formState.priority,
      estimated_minutes: formState.estimated_minutes ? Number(formState.estimated_minutes) : null,
      completed: false,
    }

    const { error } = await supabase.from('tasks').insert(payload)
    setSubmitting(false)

    if (error) {
      setErrorMessage(`The task could not be saved: ${error.message}. Please try again.`)
      return
    }

    setFormState(initialFormState)
    setShowDetails(false)
    fetchTasks()
  }

  const toggleTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase.from('tasks').update({ completed: !completed }).eq('id', taskId)

    if (error) {
      setErrorMessage(`The task status could not be updated: ${error.message}. Please try again.`)
      return
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, completed: !completed } : task)),
    )
  }

  const summary = useMemo(() => {
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
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#D8A694]/70">VEXA / tasks</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Task board</h1>
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="w-fit rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
          >
            Sign out
          </button>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-white/20 bg-[#754B4D]/70 p-4 shadow-inner">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              value={formState.title}
              onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
              placeholder="Add a task"
              className="w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 font-sans text-sm text-white outline-none placeholder:text-white/60 focus:border-[#D8A694] focus:ring-2 focus:ring-[#D8A694]/40"
            />

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDetails((current) => !current)}
                className="text-sm font-semibold text-[#D8A694] underline-offset-4 hover:underline"
              >
                {showDetails ? 'Hide details' : 'Add details'}
              </button>
              <button
                type="submit"
                disabled={submitting || !formState.title.trim()}
                className="rounded-2xl border border-white/30 bg-white/20 px-4 py-2 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Save task'}
              </button>
            </div>

            {showDetails ? (
              <div className="grid gap-4 rounded-[1.25rem] border border-white/20 bg-white/10 p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block font-sans text-sm text-[#D8A694]">Deadline</label>
                  <input
                    type="date"
                    value={formState.deadline}
                    onChange={(event) => setFormState((current) => ({ ...current, deadline: event.target.value }))}
                    className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-sans text-sm text-[#D8A694]">Priority</label>
                  <select
                    value={formState.priority}
                    onChange={(event) => setFormState((current) => ({ ...current, priority: event.target.value as TaskFormState['priority'] }))}
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
                    value={formState.estimated_minutes}
                    onChange={(event) => setFormState((current) => ({ ...current, estimated_minutes: event.target.value }))}
                    className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-sans text-sm text-[#D8A694]">Why this matters</label>
                  <input
                    value={formState.reason}
                    onChange={(event) => setFormState((current) => ({ ...current, reason: event.target.value }))}
                    className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block font-sans text-sm text-[#D8A694]">Notes</label>
                  <textarea
                    value={formState.notes}
                    onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-white/20 bg-white/20 px-3 py-2 font-sans text-sm text-white outline-none focus:border-[#D8A694]"
                  />
                </div>
              </div>
            ) : null}
          </form>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-white/80">
          <p>{summary.total} tracked</p>
          <p>{summary.completed} complete</p>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-[#D8A694]/30 bg-[#A86A65]/40 px-4 py-3 font-sans text-sm text-white">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 font-sans text-sm text-white/80">
              Loading your tasks…
            </div>
          ) : null}

          {!loading && tasks.length === 0 ? (
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-6 font-mono text-sm text-[#D8A694]">
              <div>&gt; scanning_task_database... 0 tasks detected.</div>
              <div>&gt; awaiting_input_</div>
            </div>
          ) : null}

          {!loading && tasks.length > 0
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

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default Dashboard
