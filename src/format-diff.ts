import { createTwoFilesPatch } from 'diff'
      patch += createTwoFilesPatch(names.a, names.b, contents.a || '', contents.b || '', '', '', {
        context: opts.diffUnified === 0 ? 0 : opts.diffUnified || 3,
        ignoreWhitespace: opts.diffIgnoreAllSpace,
      })