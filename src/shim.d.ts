declare module 'diff' {
  const jsDiff: {
    createTwoFilesPatch(
      oldFileName: string,
      newFileName: string,
      oldStr: string,
      newStr: string,
      oldHeader: string,
      newHeader: string,
      options?: {
        context?: number
        ignoreWhitespace?: boolean
      },
    ): string
  }
  export = jsDiff
}
