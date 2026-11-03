"""Private-session D-Bus fixture; tests protocol handling, not desktop consent UI."""
import time
import dbus
import dbus.service
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib

DBusGMainLoop(set_as_default=True)
bus = dbus.SessionBus()
name = dbus.service.BusName('org.freedesktop.portal.Desktop', bus)
objects = []

class Request(dbus.service.Object):
    @dbus.service.signal('org.freedesktop.portal.Request', signature='ua{sv}')
    def Response(self, response, results): pass

class Session(dbus.service.Object):
    @dbus.service.method('org.freedesktop.portal.Session')
    def Close(self): self.remove_from_connection()

    @dbus.service.signal('org.freedesktop.portal.Session', signature='a{sv}')
    def Closed(self, details): pass

class Portal(dbus.service.Object):
    session = None
    @dbus.service.method('org.freedesktop.DBus.Properties', in_signature='ss', out_signature='v')
    def Get(self, interface, prop): return dbus.UInt32(1)

    @dbus.service.method('org.freedesktop.DBus.Properties', in_signature='s', out_signature='a{sv}')
    def GetAll(self, interface): return {'version': dbus.UInt32(1)}

    def respond(self, sender, options, result):
        path = '/org/freedesktop/portal/desktop/request/' + sender[1:].replace('.', '_') + '/' + options['handle_token']
        request = Request(bus, path)
        objects.append(request)
        GLib.timeout_add(50, lambda: (request.Response(0, result), False)[1])
        return dbus.ObjectPath(path)

    @dbus.service.method('org.freedesktop.portal.GlobalShortcuts', in_signature='a{sv}', out_signature='o', sender_keyword='sender')
    def CreateSession(self, options, sender=None):
        self.session = '/org/freedesktop/portal/desktop/session/' + sender[1:].replace('.', '_') + '/' + options['session_handle_token']
        self.session_object = Session(bus, self.session)
        objects.append(self.session_object)
        return self.respond(sender, options, {'session_handle': dbus.String(self.session)})

    @dbus.service.method('org.freedesktop.portal.GlobalShortcuts', in_signature='oa(sa{sv})sa{sv}', out_signature='o', sender_keyword='sender')
    def BindShortcuts(self, session, shortcuts, parent, options, sender=None):
        bound = dbus.Array([(key, {'description': info['description'], 'trigger_description': info.get('preferred_trigger', '')}) for key, info in shortcuts], signature='(sa{sv})')
        return self.respond(sender, options, {'shortcuts': bound})

    @dbus.service.signal('org.freedesktop.portal.GlobalShortcuts', signature='osta{sv}')
    def Activated(self, session, shortcut, timestamp, options): pass

    @dbus.service.method('org.cleanmeter.Test')
    def EndSession(self): self.session_object.Closed({})

    @dbus.service.signal('org.freedesktop.portal.GlobalShortcuts', signature='oa(sa{sv})')
    def ShortcutsChanged(self, session, shortcuts): pass

    @dbus.service.method('org.cleanmeter.Test')
    def Rebind(self):
        self.ShortcutsChanged(self.session, [('recording', {'description': 'Recording', 'trigger_description': 'CTRL+F9'})])

    @dbus.service.method('org.cleanmeter.Test', in_signature='s')
    def Activate(self, shortcut):
        self.Activated(self.session, shortcut, int(time.time() * 1000), {})

portal = Portal(bus, '/org/freedesktop/portal/desktop')
GLib.MainLoop().run()
