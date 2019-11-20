import $$ from '../TestHelpers'
import { select } from 'xpath'

describe('XPath with Namespaces', () => {

  test('select', () => {
    const doc = $$.document("<book><title xmlns='myns'>Harry Potter</title></book>")
    const node = select("//*[local-name(.)='title' and namespace-uri(.)='myns']", doc.as.any) as any
    
    expect(node[0].namespaceURI).toBe("myns")
  })
  
})
