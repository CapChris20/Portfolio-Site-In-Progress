export function removeBlackboards(area)
{
    for(const [ key, nodes ] of area.references.items)
    {
        if(!/blackboard/i.test(key))
            continue

        for(const node of nodes)
        {
            node.visible = false
            node.parent?.remove(node)
        }
    }

    const toRemove = []

    area.model.traverse((child) =>
    {
        if(/blackboard/i.test(child.name))
            toRemove.push(child)
    })

    for(const node of toRemove)
    {
        node.visible = false
        node.parent?.remove(node)
    }

    for(const object of [ ...area.objects.items ])
    {
        const object3D = object.visual?.object3D

        if(!object3D || !/blackboard/i.test(object3D.name))
            continue

        area.game.objects.disable(object)
    }

    return {
        active: false,
        updateContent: () => {},
    }
}
