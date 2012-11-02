$(function() {
    var userName = $.cookie('userName');
    if (userName) {
        $('#userNameInput').val(userName);
        $('#openCreatePanel').fadeIn();
    }

    $('#createDocButton')
        .button()
        .click(function( event ) {
            document.location.href = 'spreadsheet/'+$('#docNameInput').val();
        });

    $('#userNameInput').keyup(function() {
        $.cookie('userName', $('#userNameInput').val(), { expires: 7, path: '/' });
        if ($('#userNameInput').val()) {
            $('#openCreatePanel').fadeIn();
        }
        else {
            $('#openCreatePanel').fadeOut();
        }
    });
});