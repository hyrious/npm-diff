declare module 'diff' {
  export declare function createTwoFilesPatch(
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
