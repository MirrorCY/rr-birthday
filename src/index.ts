import { Context, Schema, h } from 'koishi'
import { } from '@mirror_cy/gpt'
import { Lunar, Solar } from 'lunar-typescript'

export const name = 'rr-birthday'

export interface Config {
  time: number
}

export const inject = {
  optional: ['gpt']
}

export const Config: Schema<Config> = Schema.object({
  time: Schema.number().min(0).max(24).default(8).description('推送祝福的时间'),
})

interface Birthday {
  year?: number
  month?: number
  day?: number
  isGregorianCalendar?: boolean
  solar?: Solar
}

export function apply(ctx: Context, config: Config) {
  // write your plugin here
  const parser = (input: string): Birthday | null => {
    input.replace(/&\#7B;/g, '{').replace(/&\#7D;/g, '}')

    const matches = input.match(/{[\s\S]*?}/)
    if (matches) {
      let jsonString = matches[0]
      try {
        return JSON.parse(jsonString)
      } catch (e) {
        return null
      }
    } else {
      return null
    }
  }
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
  ctx
    .command(name)
    .action(async ({ session }) => {
      const id = Math.random().toString(36).slice(2)
      let birthday: Birthday
      while (true) {
        session.send(h.i18n('.askBirthday'))
        let birthdayInput = await session.prompt()
        const res = await ctx.gpt.ask(session.text('.getBirthdayJSON', [birthdayInput]), id)
        birthday = parser(res.text)

        if (!birthday) {
          session.send(h.i18n('.invalidDate'))
          continue
        }

        if (birthday.isGregorianCalendar === undefined) {
          session.send(h.i18n('.askIfLunar'))
          const isLunar = await session.prompt()
          const resIsLunar = await ctx.gpt.ask(session.text('.intentJudgment', [isLunar]), id)
          if (resIsLunar.text.includes('true')) {
            birthday.isGregorianCalendar = false
          } else if (resIsLunar.text.includes('false')) {
            birthday.isGregorianCalendar = true
          } else {
            return null
          }
        }
        try {
          if (birthday.isGregorianCalendar) {
            birthday.solar = Solar.fromYmd(birthday.year, birthday.month, birthday.day)
          } else {
            birthday.solar = Lunar.fromYmd(birthday.year, birthday.month, birthday.day).getSolar()
          }
        } catch (error) {
          session.send(h.i18n('.invalidDate'))
          continue
        }

        if (birthday.isGregorianCalendar) {
          session.send(h.i18n('.ensureBirthday', [birthday.solar.toString()]))
        } else {
          session.send(h.i18n('.ensureBirthday', [birthday.solar.getLunar().toString()]))
        }
        const ensure = await session.prompt()
        const resEnsure = await ctx.gpt.ask(session.text('.intentJudgment', [ensure]), id)
        if (resEnsure.text.includes('true')) {
          break
        }else {
          return null
        }
      }


      

    })
}
