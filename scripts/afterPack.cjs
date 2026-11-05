// electron-builder runs this after packing the app directory.
// We set the executable icon and version info here instead of letting
// electron-builder download the winCodeSign tools, because extracting that
// archive fails on Windows without symlink privileges (no Developer Mode).
const fs = require('node:fs')
const path = require('node:path')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const ResEdit = await require('resedit/cjs').load()

  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  )
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico')
  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath)) return

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true })
  const resources = ResEdit.NtExecutableResource.from(exe)

  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath))
  const icons = iconFile.icons.map((item) => item.data)
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries)
  if (groups.length > 0) {
    for (const group of groups) {
      ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        resources.entries,
        group.id,
        group.lang,
        icons,
      )
    }
  } else {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, 101, 1033, icons)
  }

  const version = context.packager.appInfo.version.split('.').map(Number)
  const versionInfos = ResEdit.Resource.VersionInfo.fromEntries(resources.entries)
  for (const info of versionInfos) {
    info.setFileVersion(version[0] || 0, version[1] || 0, version[2] || 0, 0, 1033)
    info.setProductVersion(version[0] || 0, version[1] || 0, version[2] || 0, 0, 1033)

    const languages = info.getAllLanguagesForStringValues()
    const targets = languages.length > 0 ? languages : [{ lang: 1033, codepage: 1200 }]
    for (const language of targets) {
      info.setStringValues(language, {
        ProductName: 'VibeDo',
        FileDescription: 'VibeDo — локальний планувальник задач',
        CompanyName: 'VibeDo',
        LegalCopyright: 'MIT License',
        OriginalFilename: 'VibeDo.exe',
        InternalName: 'VibeDo',
      })
    }
    info.outputToResourceEntries(resources.entries)
  }

  resources.outputResource(exe)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))
  console.log(`  • VibeDo icon and version info applied to ${path.basename(exePath)}`)
}
