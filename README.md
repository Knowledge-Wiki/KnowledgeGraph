# mediawiki-extensions-KnowledgeGraph

Visualizes SemanticMediawiki data with VisNetwork.js

## Usage

Insert a parser function like

```
{{#knowledgegraph:
nodes=Page A, Page B
|only-properties=HasProperty1,HasProperty2
|depth=3
|graph-options=Mediawiki:knowledgegraphGraphOptions
|property-options?HasProperty1=Mediawiki:knowledgegraphNodeOptionsHasProperty1
|show-toolbar=false
|width=400px
|height=400px
}}
```

'Nodes': the pages to start with
'only-properties' restricts the retrieved properties
'depth' is the recursion depth (related pages autoexpand their properties by default)
'graph-options' ... 
'property-options' ... 
'show-toolbar' ...
'width' ... 
'height' ...


## Credits
https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph



