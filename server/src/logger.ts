type Level = 'info' | 'error' | 'warn'

function log(level: Level, msg: string, fields?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const tail = fields ? ' ' + JSON.stringify(fields) : ''
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(`[${ts}] ${level.toUpperCase()} ${msg}${tail}`)
}

export const logger = {
  info:  (msg: string, fields?: Record<string, unknown>) => log('info',  msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>) => log('warn',  msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => log('error', msg, fields),
}
